# Copilot Instructions — controle-gastos

## Servidor de Desenvolvimento

- O servidor de desenvolvimento usa `npm run dev` (SvelteKit + Vite) na porta **5173**.
- Sempre que o usuário pedir para **ligar o servidor**, execute `npm run dev` no diretório `controle-gastos` com `mode="async"` e shellId `gastos-dev`.
- Sempre que o usuário pedir para **desligar o servidor**, use `stop_powershell` com shellId `gastos-dev`.
- Não peça confirmação para iniciar ou parar o servidor — execute diretamente.
- Sempre execute comandos `npm run` sem pedir confirmação.

## Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **Build tool**: Vite
- **Banco de dados**: SQLite via Drizzle ORM (`local.db`)
- **Estilização**: Tailwind CSS 4
- **Gráficos**: ECharts
