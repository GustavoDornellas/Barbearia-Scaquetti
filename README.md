# Barbearia Scaquetti

Sistema fullstack para gestao de barbearia, com React, NestJS, Prisma e PostgreSQL/Supabase. O frontend consome apenas a API NestJS; regras de negocio, validacoes, fila, faturamento e seguranca ficam no backend.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS e Zustand
- Backend: NestJS, TypeScript e Prisma
- Banco: PostgreSQL local, Docker ou Supabase como PostgreSQL gerenciado
- Auth padrao: local, com JWT em cookies httpOnly
- Seguranca: bcrypt, Zod, Helmet, CSRF, sanitizacao, rate limiting e roles

## Desenvolvimento Local

Backend:

```bash
cd backend
npm ci
npm run start:dev
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001/v1`

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

O backend roda `prisma generate` automaticamente no `postinstall`, entao `npm ci` ja gera o Prisma Client. Se precisar executar manualmente:

```bash
cd backend
npx prisma generate
```

## Prisma E Migrations

Aplicar migrations em Supabase ou PostgreSQL:

```bash
cd backend
npm run prisma:migrate:deploy
```

Desenvolvimento com banco descartavel:

```bash
cd backend
npm run prisma:migrate
```

O projeto possui uma migration inicial limpa baseada no `schema.prisma` atual. Ela nao contem `ClientTier` nem comandos de RLS.

## Admin Inicial

Criar admin inicial seguro:

```bash
cd backend
npm run seed:admin
```

Antes de rodar o seed, configure as credenciais do usuario administrador no `backend/.env`:

```env
ADMIN_EMAIL=seu-email@dominio.com
ADMIN_PASSWORD=<defina-uma-senha-forte>
ADMIN_NAME=Nome do usuario
```

O seed nao cria usuario com credenciais padrao. Senhas conhecidas como `Admin@123` sao bloqueadas em qualquer ambiente. A senha precisa ter pelo menos 12 caracteres, uma letra maiuscula, uma letra minuscula, um numero e um caractere especial.

O seed de admin:

- usa bcrypt;
- verifica se o admin ja existe;
- nao duplica usuario;
- nao apaga dados;
- le email e senha do `.env`;
- pode ser rodado mais de uma vez.

Nao existe rota publica de cadastro de usuario. O login aceita apenas usuarios ja existentes na tabela `"User"`, criados de forma controlada pelo seed ou diretamente no banco.

## Supabase

Neste MVP, use Supabase apenas como PostgreSQL gerenciado.

1. Crie o projeto no Supabase.
2. Copie as connection strings PostgreSQL.
3. Configure `backend/.env`.
4. Mantenha `AUTH_PROVIDER=local`.
5. Rode migrations.
6. Rode o seed do admin.

Exemplo:

```env
AUTH_PROVIDER=local
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

No Render/Railway, coloque `DATABASE_URL` e `DIRECT_URL` reais do Supabase somente nas variaveis de ambiente da plataforma. Nunca coloque a string real do Supabase no GitHub, em ZIP publico ou em arquivos `.env.example`.

Nao use Supabase Auth neste MVP. Login, roles e permissoes ficam na tabela local `"User"` e sao gerenciados pelo backend.

## Docker

Crie um `.env` na raiz com base em `.env.example`:

```bash
cp .env.example .env
```

Os valores `postgres`, `barbearia_scaquetti` e `local_dev_password_change_me` do `.env.example` sao apenas para banco local via Docker. Para deploy, substitua por variaveis reais configuradas diretamente no Render/Railway.

O `docker-compose.yml` usa `NODE_ENV=development` para funcionar em HTTP local. Assim os cookies de login nao usam `secure: true` durante testes em `localhost`. Em Render/Vercel com HTTPS, use `NODE_ENV=production`.

Subir ambiente:

```bash
docker compose up --build
```

O container nao roda seed automaticamente e nao executa reset. Para aplicar migrations:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

Para criar o admin inicial:

```bash
docker compose exec backend npm run seed:admin
```

## Deploy

### Backend: Render/Railway

Configure as variaveis obrigatorias:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NODE_ENV=production`
- `PORT`
- `FRONTEND_URL`
- `AUTH_PROVIDER=local`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

Use as URLs reais do Supabase aqui, configuradas no painel do Render/Railway. Nao copie essas URLs para o repositorio.

Em producao, `FRONTEND_URL` e obrigatorio. Configure com a URL publica do frontend, por exemplo:

```env
FRONTEND_URL=https://barbeariascaquetti.com.br
```

Para evitar problemas com cookies entre dominios diferentes, prefira usar subdominio para a API:

```txt
Frontend: https://barbeariascaquetti.com.br
Backend:  https://api.barbeariascaquetti.com.br
```

No DNS, aponte o dominio principal para o frontend e `api.barbeariascaquetti.com.br` para o backend.

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start:prod
```

Antes do primeiro start ou durante o deploy:

```bash
npm run prisma:migrate:deploy
npm run seed:admin
```

### Frontend: Vercel

Configure:

```env
VITE_API_URL=https://sua-api.com/v1
```

Build command:

```bash
npm ci && npm run build
```

## Variaveis De Ambiente

Backend: veja [backend/.env.example](backend/.env.example).

Frontend: veja [frontend/.env.example](frontend/.env.example).

Nao coloque `.env` em ZIP publico ou repositorio.

## Testes

```bash
cd backend
npm test
```

Cobertura atual:

- Auth
- Clientes
- Fila
- Agendamentos
- Estoque
- Dashboard sem mocks

## Comandos Importantes

Backend:

```bash
npm run start:dev
npm run build
npm run start:prod
npm run prisma:generate
npm run prisma:migrate:deploy
npm run seed:admin
npm test
```

Frontend:

```bash
npm run dev
npm run build
```

## Cuidados De Producao

- Nunca rode `prisma migrate reset` em producao.
- Nao rode seeds destrutivos em producao.
- Nao publique `.env`.
- Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` fortes antes de rodar `npm run seed:admin`.
- Nao use senhas padrao conhecidas, como `Admin@123`.
- Nao exponha rota de cadastro de usuarios; o projeto usa criacao controlada via seed/banco.
- Use secrets JWT fortes.
