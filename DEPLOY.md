# Deploy em Produção

Este projeto está preparado para:

- Frontend React/Vite na Vercel.
- Backend NestJS no Render.
- PostgreSQL no Supabase.
- Domínio via HostGator, apontado depois para Vercel e Render.

## Arquitetura Final

```text
Usuário
  -> Vercel (frontend React/Vite)
  -> Render (backend NestJS em /v1)
  -> Supabase (PostgreSQL)
```

Docker fica apenas para desenvolvimento local com `docker-compose.dev.yml`.

## Variáveis de Ambiente

### Vercel - Frontend

Configure no projeto da Vercel:

```text
VITE_API_URL=https://SEU_BACKEND_RENDER.onrender.com/v1
```

Depois que o domínio estiver pronto, pode trocar para:

```text
VITE_API_URL=https://api.seudominio.com/v1
```

### Render - Backend

Configure no Web Service do Render:

```text
NODE_ENV=production
AUTH_PROVIDER=local
PORT=3001
DATABASE_URL=
DIRECT_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://SEU_FRONTEND.vercel.app
RATE_LIMIT_PER_MINUTE=120
PRISMA_CLIENT_ENGINE_TYPE=binary
```

Use as URLs reais do Supabase em `DATABASE_URL` e `DIRECT_URL`.

Recomendação:

- `DATABASE_URL`: URL pooled/transaction pooler do Supabase, quando disponível.
- `DIRECT_URL`: URL direta do banco Supabase, usada pelo Prisma Migrate.

Gere os JWT secrets com:

```bash
openssl rand -base64 64
```

## Supabase

1. Crie o projeto no Supabase.
2. Copie as connection strings PostgreSQL.
3. Configure `DATABASE_URL` e `DIRECT_URL` no Render.
4. Não coloque essas URLs no GitHub.

## Render

O arquivo `render.yaml` define:

- Root directory: `backend`
- Build command: `npm ci --include=dev && npm run build`
- Pre-deploy command: `npm run prisma:migrate:deploy`
- Start command: `npm run start:prod`
- Healthcheck: `/v1/health`
- Runtime: Node

Passos:

1. No Render, crie um Blueprint ou Web Service apontando para este repositório.
2. Se usar Web Service manual, configure `Root Directory` como `backend`.
3. Configure as variáveis de ambiente listadas acima.
4. Faça o primeiro deploy.
5. Verifique se `/v1/health` retorna `success: true`.

## Vercel

Configure o projeto da Vercel apontando para a pasta `frontend`.

Configurações:

```text
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

O arquivo `frontend/vercel.json` garante fallback de SPA para rotas como `/clientes`, `/estoque` e `/login`.

Passos:

1. Importe o repositório na Vercel.
2. Selecione `frontend` como Root Directory.
3. Configure `VITE_API_URL`.
4. Faça o deploy.
5. Acesse as rotas internas diretamente para confirmar o SPA routing.

## HostGator / Domínio

Depois que Render e Vercel estiverem funcionando:

1. Aponte o domínio principal para a Vercel.
2. Aponte o subdomínio `api.seudominio.com` para o Render.
3. Atualize no Render:

```text
FRONTEND_URL=https://seudominio.com
```

4. Atualize na Vercel:

```text
VITE_API_URL=https://api.seudominio.com/v1
```

5. Redeploy frontend e backend.

## Checklist Final

- [ ] `.env` real não está commitado.
- [ ] `node_modules`, `dist`, `build`, logs e caches não estão commitados.
- [ ] Supabase criado e connection strings copiadas.
- [ ] Render com todas as variáveis configuradas.
- [ ] `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` têm 64+ caracteres.
- [ ] `FRONTEND_URL` usa HTTPS e não usa localhost em produção.
- [ ] Vercel com `VITE_API_URL` usando HTTPS e terminando em `/v1`.
- [ ] Render executou `prisma migrate deploy`.
- [ ] `/v1/health` retorna sucesso.
- [ ] Login funciona online.
- [ ] Clientes, fila, agendamentos, estoque e dashboard persistem no Supabase.
- [ ] Domínio final atualizado em Vercel, Render e HostGator.

## Validação de Produção

Após publicar:

1. Acesse o frontend na Vercel.
2. Faça login.
3. Cadastre um cliente.
4. Adicione cliente à fila.
5. Finalize atendimento com valor pago.
6. Cadastre produto no estoque.
7. Registre saída de produto.
8. Confirme dashboard com faturamento e produtos vendidos.
9. Recarregue a página em rotas internas, como `/clientes` e `/estoque`.
10. Verifique logs do Render para erros.
