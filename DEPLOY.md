# Deploy em Produção

Este guia mostra como publicar o sistema da Barbearia Scaquetti em produção usando:

- Frontend React/Vite na Vercel.
- Backend NestJS no Render.
- PostgreSQL no Supabase.
- Domínio pela HostGator futuramente, ainda não usado nesta etapa.

## Arquitetura Final

```text
Usuário
  -> Vercel (frontend React/Vite)
  -> Render (backend NestJS em /v1)
  -> Supabase (PostgreSQL)
```

Docker fica apenas para desenvolvimento local com `docker-compose.dev.yml`.

## Ordem Recomendada

1. Criar o banco no Supabase.
2. Publicar o backend no Render.
3. Publicar o frontend na Vercel.
4. Testar login e fluxos principais.
5. Conectar domínio na HostGator somente depois, quando quiser.

## Supabase

### O que criar

1. Entre no Supabase.
2. Crie um novo projeto.
3. Abra `Project Settings > Database > Connection string`.
4. Copie as URLs de conexão PostgreSQL.

### DATABASE_URL e DIRECT_URL

Use no Render:

```text
DATABASE_URL=
DIRECT_URL=
```

Recomendação prática:

- `DATABASE_URL`: use a connection string com pooler do Supabase para a aplicação em produção.
- `DIRECT_URL`: use uma conexão direta/session pooler compatível com migrations do Prisma.

Diferenças:

- Direct Connection: conexão direta com o banco. É útil para migrations e tarefas administrativas, mas pode consumir mais conexões.
- Session Pooler: mantém uma sessão por conexão e costuma ser mais compatível com ferramentas como Prisma Migrate.
- Transaction Pooler: reutiliza conexões por transação e ajuda em apps com muitas conexões, mas pode ter limitações com prepared statements e algumas operações de migration.

O schema Prisma já usa:

```prisma
url       = env("DATABASE_URL")
directUrl = env("DIRECT_URL")
```

Por isso o deploy consegue usar `DATABASE_URL` para runtime e `DIRECT_URL` para migrations.

## Render - Backend

O arquivo `render.yaml` já está preparado para o backend.

Configuração principal:

```text
Root Directory: backend
Build Command: npm ci --include=dev && npm run build
Pre-Deploy Command: npm run prisma:migrate:deploy
Start Command: npm run start:prod
Health Check Path: /v1/health
```

### Variáveis de ambiente no Render

Configure no serviço do Render:

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

Gere os JWT secrets com:

```bash
openssl rand -base64 64
```

Use um valor diferente para `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`.

### Passo a passo no Render

1. Acesse o Render.
2. Clique em `New`.
3. Escolha `Blueprint` se quiser usar o `render.yaml`, ou `Web Service` para configurar manualmente.
4. Conecte o repositório do GitHub.
5. Se configurar manualmente, coloque:
   - Root Directory: `backend`
   - Build Command: `npm ci --include=dev && npm run build`
   - Pre-Deploy Command: `npm run prisma:migrate:deploy`
   - Start Command: `npm run start:prod`
   - Health Check Path: `/v1/health`
6. Configure todas as variáveis de ambiente.
7. Faça o deploy.
8. Teste:

```text
https://SEU_BACKEND.onrender.com/v1/health
```

A resposta deve indicar sucesso e banco conectado.

## Vercel - Frontend

O arquivo `frontend/vercel.json` já configura:

- install command com `npm ci`;
- build command com `npm run build`;
- output directory `dist`;
- fallback SPA para rotas internas.

### Variável de ambiente na Vercel

Configure no projeto da Vercel:

```text
VITE_API_URL=https://SEU_BACKEND.onrender.com/v1
```

Enquanto não tiver domínio, use a URL padrão do Render.

Quando tiver domínio, troque para algo como:

```text
VITE_API_URL=https://api.seudominio.com/v1
```

### Passo a passo na Vercel

1. Acesse a Vercel.
2. Clique em `Add New > Project`.
3. Importe o repositório do GitHub.
4. Configure:
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Adicione a variável `VITE_API_URL`.
6. Faça o deploy.
7. Teste rotas internas como:
   - `/login`
   - `/clientes`
   - `/estoque`

O fallback do `vercel.json` evita erro 404 ao recarregar uma rota interna.

## HostGator / Domínio

Nesta etapa o domínio ainda não será usado.

Quando for conectar:

1. Aponte o domínio principal para a Vercel.
2. Aponte um subdomínio como `api.seudominio.com` para o Render.
3. Atualize no Render:

```text
FRONTEND_URL=https://seudominio.com
```

4. Atualize na Vercel:

```text
VITE_API_URL=https://api.seudominio.com/v1
```

5. Faça redeploy do frontend e backend.

## Segurança

Antes de publicar, confirme:

- `.env` real não está no GitHub.
- `node_modules`, `dist`, `build`, logs e caches não estão no GitHub.
- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` têm 64+ caracteres.
- `FRONTEND_URL` usa HTTPS em produção.
- `VITE_API_URL` usa HTTPS e termina em `/v1`.
- `DATABASE_URL` e `DIRECT_URL` estão apenas no Render.
- Cookies estão `httpOnly`.
- Cookies usam `secure=true` em produção.
- CORS permite apenas a URL do frontend.
- O endpoint `/v1/health` está funcionando.

## Checklist Final

- [ ] Projeto criado no Supabase.
- [ ] Connection strings copiadas.
- [ ] Backend criado no Render.
- [ ] Variáveis do Render configuradas.
- [ ] Migrations aplicadas com `prisma migrate deploy`.
- [ ] Healthcheck `/v1/health` funcionando.
- [ ] Frontend criado na Vercel.
- [ ] `VITE_API_URL` configurado na Vercel.
- [ ] Login funcionando online.
- [ ] Clientes persistindo no Supabase.
- [ ] Fila persistindo no Supabase.
- [ ] Estoque persistindo no Supabase.
- [ ] Dashboard calculando faturamento real.
- [ ] Rotas internas funcionando ao recarregar a página.

## Validação de Produção

Depois do deploy:

1. Acesse o frontend publicado na Vercel.
2. Faça login.
3. Cadastre um cliente.
4. Adicione cliente à fila.
5. Finalize atendimento com valor pago.
6. Cadastre produto no estoque.
7. Registre saída de produto.
8. Confirme dashboard com faturamento e produtos vendidos.
9. Recarregue `/clientes` e `/estoque` diretamente no navegador.
10. Verifique logs do Render para erros.
