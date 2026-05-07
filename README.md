# Barbearia Scaquetti

Sistema web fullstack para gestao de barbearia, desenvolvido para centralizar fila de espera, clientes, agendamentos, estoque e dashboard financeiro em uma interface moderna, responsiva e segura.

O projeto foi pensado como um MVP profissional para uma unica barbearia, com acesso controlado por usuario administrador criado via seed seguro.

## Funcionalidades

- Dashboard com faturamento, clientes, ticket medio, servicos mais feitos, ultimos atendimentos e tendencia de fluxo.
- Fila de espera com horario previsto, tempo estimado, chamada por WhatsApp e finalizacao com valor pago.
- Cadastro e gestao de clientes, com busca, paginacao e historico de atendimentos.
- Agendamentos com validacao de horario, conflito e status.
- Estoque com produtos, entrada/saida, movimentacoes e alerta de baixo estoque.
- Autenticacao com JWT em cookies httpOnly.
- Backend com validacao, sanitizacao, rate limit, CSRF e respostas padronizadas.
- Docker para ambiente local.

## Stack

### Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- Zustand

### Backend

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- JWT
- bcrypt
- Zod

### Banco

- PostgreSQL local via Docker
- Supabase como PostgreSQL gerenciado

> Neste MVP, Supabase e usado apenas como banco PostgreSQL. A autenticacao fica no backend local, pela tabela `User`.

## Estrutura

```txt
backend/
  prisma/
  src/
    modules/
    shared/
    database/

frontend/
  src/
    components/
    pages/
    services/
    store/
    layouts/
```

## Seguranca

- Nao existe cadastro publico de usuarios.
- O login aceita apenas usuarios existentes no banco.
- O usuario inicial e criado por `npm run seed:admin`.
- Senhas sao armazenadas com bcrypt.
- Refresh token fica em cookie httpOnly.
- Secrets e URLs reais devem ficar apenas em variaveis de ambiente.
- Arquivos `.env` nao devem ser enviados ao GitHub.

## Variaveis De Ambiente

Copie os arquivos de exemplo e preencha os valores locais:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Principais variaveis do backend:

```env
NODE_ENV=development
AUTH_PROVIDER=local
DATABASE_URL=
DIRECT_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=http://localhost:5173
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

`ADMIN_PASSWORD` deve ter pelo menos 12 caracteres, letra maiuscula, letra minuscula, numero e caractere especial.

## Rodando Localmente

### Backend

```bash
cd backend
npm ci
npm run prisma:migrate
npm run seed:admin
npm run start:dev
```

API:

```txt
http://localhost:3001/v1
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Aplicacao:

```txt
http://localhost:5173
```

## Docker Local

Crie um `.env` na raiz com base no `.env.example`:

```bash
cp .env.example .env
```

Suba os containers:

```bash
docker compose up --build
```

Aplicar migrations:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

Criar admin inicial:

```bash
docker compose exec backend npm run seed:admin
```

O Docker local usa `NODE_ENV=development` para permitir cookies em HTTP local. Em deploy HTTPS, use `NODE_ENV=production`.

## Supabase

Use Supabase apenas como PostgreSQL gerenciado:

1. Crie um projeto no Supabase.
2. Copie as connection strings PostgreSQL.
3. Configure `DATABASE_URL` e `DIRECT_URL` no backend.
4. Rode migrations.
5. Rode o seed do admin.

```bash
cd backend
npm run prisma:migrate:deploy
npm run seed:admin
```

Nunca publique a connection string real do Supabase.

## Build

Backend:

```bash
cd backend
npm ci
npm run build
```

Frontend:

```bash
cd frontend
npm ci
npm run build
```

## Testes

```bash
cd backend
npm test
```

Cobertura atual:

- Autenticacao
- Clientes
- Fila
- Agendamentos
- Estoque
- Dashboard com dados reais

## Deploy

### Backend

Recomendado: Render ou Railway.

Configure no painel da hospedagem:

```env
NODE_ENV=production
AUTH_PROVIDER=local
DATABASE_URL=
DIRECT_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=https://seu-dominio.com.br
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start:prod
```

Antes do primeiro uso:

```bash
npm run prisma:migrate:deploy
npm run seed:admin
```

### Frontend

Recomendado: Vercel.

Configure:

```env
VITE_API_URL=https://api.seu-dominio.com.br/v1
```

Build command:

```bash
npm ci && npm run build
```

## Dominios Recomendados

Para evitar problemas de cookies e CORS em producao, use:

```txt
Frontend: https://barbeariascaquetti.com.br
Backend:  https://api.barbeariascaquetti.com.br
```

## Cuidados

- Nao publique `.env`.
- Nao rode `prisma migrate reset` em producao.
- Nao use seeds destrutivos.
- Nao use senhas padrao.
- Use secrets JWT fortes.
- Mantenha o repositorio privado se o projeto for comercial.

## Status

MVP funcional, com foco em uso real por uma barbearia e preparado para evoluir para deploy publico com dominio proprio.
