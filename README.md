# Barbearia Scaquetti

## Sobre o projeto

Sistema web completo para gerenciamento operacional de barbearias, desenvolvido com foco em controle de atendimentos, fila de espera, clientes, estoque, vendas de produtos e métricas em tempo real.

O projeto foi desenvolvido utilizando arquitetura fullstack moderna, com backend em NestJS, frontend em React e banco PostgreSQL via Supabase.

## Funcionalidades

- Dashboard com faturamento, clientes cadastrados, produtos vendidos hoje, produtos mais vendidos, últimos atendimentos e tendência de fluxo.
- Fila de espera com horário previsto, tempo estimado, chamada por WhatsApp e finalização com valor pago.
- Cadastro e gestão de clientes, com busca, paginação e histórico de atendimentos.
- Agendamentos com validação de horário, conflito e status.
- Estoque com produtos, marca, entrada/saída, movimentações, vendas e alerta de baixo estoque.
- Autenticação com JWT em cookies httpOnly.
- Backend com validação, sanitização, rate limit, CSRF e respostas padronizadas.
- Deploy preparado para Vercel, Render e Supabase.
- Docker apenas para ambiente local de desenvolvimento.

## Problema que o sistema resolve

Muitas barbearias ainda realizam o controle de atendimentos, fila, clientes, estoque e faturamento de forma manual ou utilizando ferramentas desconectadas, como papel, planilhas ou aplicativos genéricos.

Isso gera problemas como:

- perda de informações de clientes;
- dificuldade para acompanhar faturamento;
- falta de organização da fila de atendimento;
- ausência de histórico de serviços;
- dificuldade para visualizar horários de maior movimento;
- controle de estoque ineficiente;
- baixa visibilidade operacional do negócio.

Além disso, pequenos estabelecimentos normalmente não possuem sistemas simples, modernos e acessíveis voltados especificamente para o fluxo real de uma barbearia.

## Solução adotada

O sistema foi desenvolvido para centralizar toda a operação da barbearia em uma única plataforma web.

A solução implementada permite:

- gerenciamento de fila em tempo real;
- controle completo de clientes e histórico de atendimentos;
- cálculo automático de faturamento;
- dashboard com métricas operacionais reais;
- análise de horários de maior movimento;
- controle de estoque e movimentações;
- registro de vendas de produtos;
- gerenciamento de agendamentos;
- atualização automática de métricas baseada nos dados do banco.

A arquitetura foi construída utilizando React no frontend, NestJS no backend e PostgreSQL via Supabase, garantindo:

- separação clara de responsabilidades;
- escalabilidade;
- segurança;
- facilidade de manutenção;
- integração com banco de dados gerenciado;
- deploy em ambientes cloud modernos.

### Frontend

- React
- Vite
- TypeScript
- TailwindCSS

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL

### Banco

- PostgreSQL local via Docker para desenvolvimento.
- Supabase como PostgreSQL gerenciado em produção.

### Deploy

- Vercel (Frontend)
- Render (Backend)
- Supabase (Database)
- HostGator (Domínio/DNS futuramente)

## Funcionalidades

### Dashboard Inteligente

- faturamento diário;
- faturamento semanal;
- produtos vendidos hoje;
- produtos mais vendidos;
- últimos atendimentos;
- tendência de fluxo da barbearia;
- métricas calculadas com dados reais do banco.

## Gestão de Clientes

- cadastro de clientes;
- histórico de atendimentos;
- controle de recorrência;
- busca e paginação;
- soft delete para preservação de histórico.

## Fila de Atendimento

- fila em tempo real;
- chamada do próximo cliente;
- controle de status;
- finalização de atendimento;
- atualização automática do dashboard.

## Agendamentos

- criação e gerenciamento de agendamentos;
- validação de horários;
- atualização de status;
- integração com faturamento.

## Controle de Estoque

- cadastro de produtos;
- cadastro de marca;
- movimentações de estoque;
- controle de entradas e saídas;
- registro de venda de produtos;
- alertas de estoque baixo.

## Segurança

- autenticação JWT;
- cookies HTTP Only;
- cookies seguros em produção;
- proteção com Helmet;
- proteção CSRF;
- rate limiting;
- validação de inputs;
- sanitização de entradas;
- bcrypt para senhas;
- CORS configurado por origem permitida;
- variáveis sensíveis fora do GitHub.

## Deploy em produção

O projeto está preparado para publicação com:

- Frontend na Vercel;
- Backend no Render;
- Banco PostgreSQL no Supabase;
- Domínio pela HostGator futuramente.

O passo a passo completo de publicação está em [DEPLOY.md](./DEPLOY.md).

## Autor

Gustavo Dornellas

## Licença

Projeto privado. Todos os direitos reservados.
