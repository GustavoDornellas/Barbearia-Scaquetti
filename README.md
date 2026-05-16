# Barbearia Scaquetti

## Sobre o projeto

Sistema web completo para gerenciamento operacional de barbearias, desenvolvido com foco em controle de atendimentos, fila de espera, clientes, estoque e métricas em tempo real.

O projeto foi desenvolvido utilizando arquitetura fullstack moderna, com backend em NestJS, frontend em React e banco PostgreSQL via Supabase.

## Funcionalidades

- Dashboard com faturamento, clientes, ticket medio, servicos mais feitos, ultimos atendimentos e tendencia de fluxo.
- Fila de espera com horario previsto, tempo estimado, chamada por WhatsApp e finalizacao com valor pago.
- Cadastro e gestao de clientes, com busca, paginacao e historico de atendimentos.
- Agendamentos com validacao de horario, conflito e status.
- Estoque com produtos, entrada/saida, movimentacoes e alerta de baixo estoque.
- Autenticacao com JWT em cookies httpOnly.
- Backend com validacao, sanitizacao, rate limit, CSRF e respostas padronizadas.
- Docker para ambiente local.

## Problema que o sistema resolve

Muitas barbearias ainda realizam o controle de atendimentos, fila, clientes e faturamento de forma manual ou utilizando ferramentas desconectadas, como papel, planilhas ou aplicativos genéricos.

Isso gera problemas como:

perda de informações de clientes
dificuldade para acompanhar faturamento
falta de organização da fila de atendimento
ausência de histórico de serviços
dificuldade para visualizar horários de maior movimento
controle de estoque ineficiente
baixa visibilidade operacional do negócio

Além disso, pequenos estabelecimentos normalmente não possuem sistemas simples, modernos e acessíveis voltados especificamente para o fluxo real de uma barbearia.

## Solução adotada

O sistema foi desenvolvido para centralizar toda a operação da barbearia em uma única plataforma web.

A solução implementada permite:

gerenciamento de fila em tempo real
controle completo de clientes e histórico de atendimentos
cálculo automático de faturamento
dashboard com métricas operacionais reais
análise de horários de maior movimento
controle de estoque e movimentações
gerenciamento de agendamentos
atualização automática de métricas baseada nos dados do banco

A arquitetura foi construída utilizando React no frontend, NestJS no backend e PostgreSQL via Supabase, garantindo:

separação clara de responsabilidades
escalabilidade
segurança
facilidade de manutenção
integração em tempo real com banco de dados
deploy em ambientes cloud modernos

### Frontend

- React
- TypeScript
- TailwindCSS

### Backend

- NestJS
- TypeScript
- Prisma
- PostgreSQL

### Banco

- PostgreSQL local via Docker
- Supabase como PostgreSQL gerenciado

### Deploy

- Vercel (Frontend)
- Render (Backend)
- Supabase (Database)
- HostGator (Domínio/DNS)


## Funcionalidades

### Dashboard Inteligente

- faturamento diário
- faturamento semanal
- ticket médio
- serviços mais realizados
- últimos atendimentos
- tendência de fluxo da barbearia
- métricas calculadas com dados reais do banco

## Gestão de Clientes
- cadastro de clientes
- histórico de atendimentos
- controle de recorrência
- soft delete para preservação de histórico

## Fila de Atendimento
- fila em tempo real
- chamada do próximo cliente
- controle de status
- atualização automática do dashboard

## Agendamentos
- criação e gerenciamento de agendamentos
- atualização de status
- integração com faturamento

## Controle de Estoque
- cadastro de produtos
- movimentações de estoque
- controle de entradas e saídas
- alertas de estoque baixo

## Segurança
- autenticação JWT
- cookies HTTP Only
- proteção com Helmet
- rate limiting
- validação de inputs
- bcrypt para senhas
- CORS configurado

## Autor

Gustavo Dornellas

## Licença

Projeto privado. Todos os direitos reservados.