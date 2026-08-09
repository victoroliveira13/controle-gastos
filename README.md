# Controle de Gastos

Aplicação pessoal de controle financeiro: categoriza receitas e despesas, projeta orçamento mensal, fecha o mês e sincroniza transações bancárias automaticamente via Open Finance (Pluggy).

## Funcionalidades

- **Dashboard** com visão consolidada por mês (gráficos via ECharts).
- **Transações**: lançamento manual, edição e categorização.
- **Categorias e grupos**: organização de receitas/despesas por grupo (ex. Moradia, Alimentação, Transporte).
- **Orçamento previsto** por categoria e mês.
- **Fechamento mensal**: imprevistos, gastos superfluos, observações.
- **Importação** de extratos (CSV/XLSX), com parsing de datas e valores em formato brasileiro.
- **Sincronização automática** com contas bancárias via [Pluggy](https://pluggy.ai) (Open Finance), com deduplicação por ID da transação.

## Stack

- [SvelteKit 2](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte) + TypeScript
- [Drizzle ORM](https://orm.drizzle.team/) + SQLite (`better-sqlite3`)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [ECharts](https://echarts.apache.org/) para gráficos
- [Vitest](https://vitest.dev/) para testes unitários

## Rodando localmente

Pré-requisitos: Node 20+.

```sh
npm install
cp .env.example .env
```

Edite o `.env`:

```
DATABASE_URL=local.db
PLUGGY_CLIENT_ID=       # opcional, só necessário para sincronização bancária
PLUGGY_CLIENT_SECRET=   # opcional, obtido em https://dashboard.pluggy.ai
```

Aplique o schema no banco e (opcionalmente) popule categorias padrão:

```sh
npm run db:push
npm run db:seed
```

Inicie o servidor de desenvolvimento:

```sh
npm run dev
```

## Scripts

| Comando            | Descrição                                    |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                   |
| `npm run build`     | Build de produção                             |
| `npm run preview`   | Preview do build                              |
| `npm run test`      | Roda a suíte de testes (Vitest)               |
| `npm run test:watch`| Testes em modo watch                          |
| `npm run check`     | Type-check (svelte-check)                     |
| `npm run lint`      | Prettier + ESLint                             |
| `npm run db:studio` | Abre o Drizzle Studio para inspecionar o banco |

## Estrutura

```
src/
  lib/
    server/
      db/          schema, seed, acesso a dados
      pluggy.ts    integração com a API Pluggy
      pluggy-sync.ts  sincronização automática de transações
    utils/         funções puras (formatação, parsing)
    components/    componentes Svelte reutilizáveis
  routes/
    api/           endpoints REST (import, pluggy)
    dashboard, transactions, categories, previsto, fechamento, settings
```
