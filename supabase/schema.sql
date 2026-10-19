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

-- ---------- Localização e serviços (na própria empresa) ----------
alter table public.empresas add column if not exists latitude    double precision;
alter table public.empresas add column if not exists longitude   double precision;
alter table public.empresas add column if not exists servicos    jsonb not null default '[]'::jsonb;

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

-- ---------- Perfis de usuário (admin / colaborador) ----------
create table if not exists public.perfis (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text not null default '',
  email      text,
  papel      text not null default 'colaborador' check (papel in ('admin', 'colaborador')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Usuário logado com perfil ativo (quem for desativado perde o acesso na hora)
create or replace function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and ativo);
$$;

-- Usuário logado é administrador
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and ativo and papel = 'admin');
$$;

-- Todo usuário novo (criado em Authentication → Users) ganha perfil de colaborador
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Perfis para os usuários que já existiam
insert into public.perfis (user_id, nome, email)
select id, split_part(email, '@', 1), email from auth.users
on conflict (user_id) do nothing;

-- Administrador principal
update public.perfis set papel = 'admin', ativo = true where email = 'andreperin67@gmail.com';

-- ---------- Mensalidades (financeiro — só administradores) ----------
create table if not exists public.mensalidades (
  empresa_id     text primary key references public.empresas (id) on delete cascade,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

-- Migração: a mensalidade ficava numa coluna de "empresas", visível para todos
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'empresas' and column_name = 'mensalidade') then
    insert into public.mensalidades (empresa_id, dados)
    select id, mensalidade from public.empresas where mensalidade is not null
    on conflict (empresa_id) do update set dados = excluded.dados;
    alter table public.empresas drop column mensalidade;
  end if;
end $$;

-- ---------- Registro de atividades (auditoria) ----------
create table if not exists public.atividades (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  user_id       uuid default auth.uid(),
  usuario       text,
  acao          text not null,   -- criou | editou | excluiu | concluiu | reabriu | entrou
  tabela        text,
  registro_id   text,
  empresa_id    text,
  empresa_nome  text,
  descricao     text,
  antes         jsonb,
  depois        jsonb
);
create index if not exists atividades_data_idx on public.atividades (criado_em desc);
create index if not exists atividades_usuario_idx on public.atividades (user_id, criado_em desc);

-- Grava automaticamente toda alteração feita nas tabelas do sistema
create or replace function public.registrar_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_depois  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_reg     jsonb := coalesce(v_depois, v_antes);
  v_emp_id  text;
  v_emp     text;
  v_acao    text;
begin
  -- Gravação sem mudança real (o app regrava a empresa inteira ao salvar)
  if tg_op = 'UPDATE' and (v_depois - 'atualizado_em') = (v_antes - 'atualizado_em') then
    return null;
  end if;

  v_emp_id := case when tg_table_name = 'empresas' then v_reg ->> 'id' else v_reg ->> 'empresa_id' end;
  if tg_table_name = 'empresas' then
    v_emp := coalesce(nullif(v_reg ->> 'nome_fantasia', ''), v_reg ->> 'razao_social');
  else
    select coalesce(nullif(nome_fantasia, ''), razao_social) into v_emp from public.empresas where id = v_emp_id;
    -- Itens apagados junto com a empresa: basta o registro da exclusão da empresa
    if tg_op = 'DELETE' and v_emp is null then
      return null;
    end if;
  end if;

  v_acao := case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'editou' else 'excluiu' end;
  if tg_table_name = 'eventos' and tg_op = 'UPDATE' and (v_antes ->> 'status') is distinct from (v_depois ->> 'status') then
    v_acao := case when v_depois ->> 'status' = 'concluido' then 'concluiu' else 'reabriu' end;
  end if;

  insert into public.atividades (user_id, usuario, acao, tabela, registro_id, empresa_id, empresa_nome, descricao, antes, depois)
  values (
    auth.uid(),
    (select nome from public.perfis where user_id = auth.uid()),
    v_acao,
    tg_table_name,
    coalesce(v_reg ->> 'id', v_reg ->> 'empresa_id'),
    v_emp_id,
    v_emp,
    case tg_table_name
      when 'empresas' then v_emp
      when 'eventos' then v_reg ->> 'titulo'
      when 'condicionantes' then concat_ws(' – ', nullif(v_reg ->> 'numero', ''), left(v_reg ->> 'descricao', 80))
      when 'anexos' then v_reg ->> 'nome'
      when 'mensalidades' then 'mensalidade'
    end,
    v_antes,
    v_depois
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['empresas', 'condicionantes', 'eventos', 'anexos', 'mensalidades'] loop
    execute format('drop trigger if exists registrar_atividade on public.%I', t);
    execute format('create trigger registrar_atividade after insert or update or delete on public.%I
                    for each row execute function public.registrar_atividade()', t);
  end loop;
end $$;

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

drop trigger if exists mensalidades_atualizado_em on public.mensalidades;
create trigger mensalidades_atualizado_em
  before update on public.mensalidades
  for each row execute function public.tocar_atualizado_em();

-- ---------- Segurança (RLS) ----------
-- Só usuários logados e com perfil ativo acessam os dados. Mensalidades e o
-- registro de atividades são exclusivos de administradores. Desative o cadastro
-- público em Authentication → Sign In / Providers.
alter table public.empresas       enable row level security;
alter table public.condicionantes enable row level security;
alter table public.eventos        enable row level security;
alter table public.anexos         enable row level security;
alter table public.perfis         enable row level security;
alter table public.mensalidades   enable row level security;
alter table public.atividades     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['empresas', 'condicionantes', 'eventos', 'anexos'] loop
    execute format('drop policy if exists "equipe_le" on public.%I', t);
    execute format('drop policy if exists "equipe_insere" on public.%I', t);
    execute format('drop policy if exists "equipe_altera" on public.%I', t);
    execute format('drop policy if exists "equipe_exclui" on public.%I', t);
    execute format('create policy "equipe_le" on public.%I for select to authenticated using (public.usuario_ativo())', t);
    execute format('create policy "equipe_insere" on public.%I for insert to authenticated with check (public.usuario_ativo())', t);
    execute format('create policy "equipe_altera" on public.%I for update to authenticated using (public.usuario_ativo()) with check (public.usuario_ativo())', t);
    execute format('create policy "equipe_exclui" on public.%I for delete to authenticated using (public.usuario_ativo())', t);
  end loop;
end $$;

-- Perfis: todos da equipe veem os nomes; só administrador altera
drop policy if exists "perfis_le" on public.perfis;
drop policy if exists "perfis_admin_insere" on public.perfis;
drop policy if exists "perfis_admin_altera" on public.perfis;
drop policy if exists "perfis_admin_exclui" on public.perfis;
create policy "perfis_le" on public.perfis for select to authenticated using (public.usuario_ativo() or user_id = auth.uid());
create policy "perfis_admin_insere" on public.perfis for insert to authenticated with check (public.eh_admin());
create policy "perfis_admin_altera" on public.perfis for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "perfis_admin_exclui" on public.perfis for delete to authenticated using (public.eh_admin());

-- Mensalidades: somente administradores
drop policy if exists "financeiro_admin" on public.mensalidades;
create policy "financeiro_admin" on public.mensalidades for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- Atividades: só administrador lê; ninguém edita ou apaga
drop policy if exists "atividades_admin_le" on public.atividades;
drop policy if exists "atividades_registra" on public.atividades;
create policy "atividades_admin_le" on public.atividades for select to authenticated using (public.eh_admin());
create policy "atividades_registra" on public.atividades for insert to authenticated with check (user_id = auth.uid());

-- ---------- Arquivos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 26214400)  -- 25 MB por arquivo
on conflict (id) do nothing;

drop policy if exists "documentos_le" on storage.objects;
drop policy if exists "documentos_envia" on storage.objects;
drop policy if exists "documentos_altera" on storage.objects;
drop policy if exists "documentos_exclui" on storage.objects;
create policy "documentos_le" on storage.objects for select to authenticated using (bucket_id = 'documentos' and public.usuario_ativo());
create policy "documentos_envia" on storage.objects for insert to authenticated with check (bucket_id = 'documentos' and public.usuario_ativo());
create policy "documentos_altera" on storage.objects for update to authenticated using (bucket_id = 'documentos' and public.usuario_ativo());
create policy "documentos_exclui" on storage.objects for delete to authenticated using (bucket_id = 'documentos' and public.usuario_ativo());

-- ---------- Tempo real (celular e computador sincronizados) ----------
do $$
declare t text;
begin
  foreach t in array array['empresas', 'condicionantes', 'eventos', 'anexos', 'mensalidades', 'atividades'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
