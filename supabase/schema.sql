-- =====================================================================
-- VACG · Gestão Ambiental — esquema do banco (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- ---------- Empresas ----------
create table if not exists public.empresas (
  id                  text primary key,
  razao_social        text not null,
  nome_fantasia       text,
  cnpj                text,
  atividade           text,
  cnae                text,
  porte               text,
  potencial_poluidor  text,
  orgao_ambiental     text,
  cep                 text,
  endereco            text,
  cidade              text,
  uf                  text,
  responsavel         text,
  telefone            text,
  email               text,
  observacoes         text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  criado_por          uuid default auth.uid() references auth.users (id) on delete set null
);

-- ---------- Condicionantes (de cada empresa) ----------
create table if not exists public.condicionantes (
  id             text primary key,
  empresa_id     text not null references public.empresas (id) on delete cascade,
  numero         text,
  descricao      text,
  licenca_ref    text,
  prazo          date,
  periodicidade  text not null default 'nenhuma',
  status         text not null default 'pendente'
                 check (status in ('pendente', 'andamento', 'cumprida')),
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists condicionantes_empresa_idx on public.condicionantes (empresa_id);

-- ---------- Eventos de controle (avisos de vencimento) ----------
create table if not exists public.eventos (
  id                 text primary key,
  empresa_id         text not null references public.empresas (id) on delete cascade,
  condicionante_id   text references public.condicionantes (id) on delete set null,
  tipo               text not null default 'outro'
                     check (tipo in ('licenca', 'analise', 'condicionante', 'relatorio', 'taxa', 'outro')),
  titulo             text not null,
  documento          text,
  data_vencimento    date not null,
  antecedencia_dias  integer not null default 30,
  recorrencia        text not null default 'nenhuma',
  status             text not null default 'pendente'
                     check (status in ('pendente', 'concluido')),
  concluido_em       date,
  observacoes        text,
  criado_em          timestamptz not null default now(),
  criado_por         uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists eventos_empresa_idx on public.eventos (empresa_id);
create index if not exists eventos_vencimento_idx on public.eventos (data_vencimento) where status = 'pendente';

-- ---------- Localização, serviços e mensalidade (na própria empresa) ----------
alter table public.empresas add column if not exists latitude    double precision;
alter table public.empresas add column if not exists longitude   double precision;
alter table public.empresas add column if not exists servicos    jsonb not null default '[]'::jsonb;
alter table public.empresas add column if not exists mensalidade jsonb;

-- ---------- Documentos anexados (o arquivo fica no Storage, bucket "documentos") ----------
create table if not exists public.anexos (
  id           text primary key,
  empresa_id   text not null references public.empresas (id) on delete cascade,
  nome         text not null,
  tipo         text,
  tamanho      bigint,
  categoria    text not null default 'outro',
  descricao    text,
  validade     date,
  enviado_em   timestamptz not null default now(),
  enviado_por  uuid default auth.uid() references auth.users (id) on delete set null
);
create index if not exists anexos_empresa_idx on public.anexos (empresa_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 26214400)  -- 25 MB por arquivo
on conflict (id) do nothing;

drop policy if exists "documentos_le" on storage.objects;
drop policy if exists "documentos_envia" on storage.objects;
drop policy if exists "documentos_altera" on storage.objects;
drop policy if exists "documentos_exclui" on storage.objects;
create policy "documentos_le" on storage.objects for select to authenticated using (bucket_id = 'documentos');
create policy "documentos_envia" on storage.objects for insert to authenticated with check (bucket_id = 'documentos');
create policy "documentos_altera" on storage.objects for update to authenticated using (bucket_id = 'documentos');
create policy "documentos_exclui" on storage.objects for delete to authenticated using (bucket_id = 'documentos');

-- ---------- Atualiza "atualizado_em" automaticamente ----------
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists empresas_atualizado_em on public.empresas;
create trigger empresas_atualizado_em
  before update on public.empresas
  for each row execute function public.tocar_atualizado_em();

-- ---------- Segurança (RLS) ----------
-- Somente usuários logados acessam os dados. Todos os usuários cadastrados
-- enxergam e editam tudo (é uma equipe só). Desative o cadastro público em
-- Authentication → Sign In / Providers para que só quem você convidar entre.
alter table public.empresas       enable row level security;
alter table public.condicionantes enable row level security;
alter table public.eventos        enable row level security;
alter table public.anexos         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['empresas', 'condicionantes', 'eventos', 'anexos'] loop
    execute format('drop policy if exists "equipe_le" on public.%I', t);
    execute format('drop policy if exists "equipe_insere" on public.%I', t);
    execute format('drop policy if exists "equipe_altera" on public.%I', t);
    execute format('drop policy if exists "equipe_exclui" on public.%I', t);
    execute format('create policy "equipe_le" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "equipe_insere" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "equipe_altera" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "equipe_exclui" on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ---------- Tempo real (celular e computador sincronizados) ----------
do $$
declare t text;
begin
  foreach t in array array['empresas', 'condicionantes', 'eventos', 'anexos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
