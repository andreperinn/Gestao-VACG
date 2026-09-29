# VACG · Gestão Ambiental

Sistema web para gestão de clientes de consultoria ambiental: cadastro de empresas, condicionantes de licenças, avisos de vencimento, serviços prestados, mensalidades e documentos. Funciona no computador e no celular (pode ser instalado na tela inicial como aplicativo).

## Funcionalidades

- **Empresas** — dados cadastrais, localização no mapa (com rota no Google Maps), serviços prestados, mensalidade e documentos anexados.
- **Condicionantes** — cadastro por empresa (inclusive colando a lista direto do certificado da licença), com situação e prazo.
- **Eventos de controle** — avisos de vencimento de licenças, análises, condicionantes, relatórios e taxas, com antecedência configurável e repetição automática (mensal, trimestral, anual…).
- **Painel** — itens vencidos e a vencer, vencimentos por mês, situação das empresas e mensalidades do mês.
- **Agenda** — calendário mensal com todos os vencimentos.
- **Alertas** — vencidos, dentro do prazo de aviso e próximos meses.
- **Mensalidades** — quadro dos 12 meses por empresa para marcar pagamentos e ver atrasos.
- **Documentos** — PDFs, fotos e outros arquivos por empresa, com categoria e validade.
- **Login e sincronização em tempo real** entre aparelhos.

## Tecnologias

- [React](https://react.dev) + [Vite](https://vite.dev)
- [Supabase](https://supabase.com) — banco PostgreSQL, autenticação, armazenamento de arquivos e tempo real
- [Leaflet](https://leafletjs.com) + OpenStreetMap — mapas
- [Lucide](https://lucide.dev) — ícones

## Rodando localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Sem configurar o Supabase, o sistema roda em **modo local**: os dados ficam salvos apenas no navegador.

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql). Ele cria as tabelas, as regras de acesso (RLS), o bucket de documentos e habilita o tempo real.
3. Em **Authentication → Sign In / Providers**, desative o cadastro público ("Allow new users to sign up") e crie os usuários em **Authentication → Users**.
4. Em **Authentication → URL Configuration**, defina o **Site URL** com o endereço onde o sistema está publicado.
5. Copie `.env.example` para `.env` e preencha com a URL do projeto e a chave *publishable*:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> Use somente a chave *publishable* (anon). Nunca coloque a chave `secret` / `service_role` no front-end.

## Publicação

O projeto é um site estático (`npm run build` gera a pasta `dist`). Pode ser publicado na Vercel, Netlify, Cloudflare Pages ou similar — basta configurar as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no serviço de hospedagem.

## Estrutura

```
src/
  App.jsx            layout, navegação e login
  store.jsx          estado da aplicação (modo local ou Supabase)
  db.js              leitura e gravação no Supabase
  arquivos.js        documentos (Supabase Storage ou navegador)
  pages/             telas (painel, empresas, agenda, alertas, dados, login)
  components/        formulários, mapa, documentos e componentes de interface
supabase/schema.sql  estrutura do banco
```
