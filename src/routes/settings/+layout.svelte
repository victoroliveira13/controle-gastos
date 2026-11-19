<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const tabs = [
		{ href: '/settings', label: '⚙️ Geral' },
		{ href: '/settings/categories', label: '🏷️ Categorias' },
		{ href: '/settings/import', label: '📂 Importar' }
	];
</script>

<nav class="mx-8 mt-8 flex w-fit gap-1 rounded-xl bg-slate-100 p-1" aria-label="Configurações">
	{#each tabs as tab}
		<a
			href={tab.href}
			aria-current={page.url.pathname === tab.href ? 'page' : undefined}
			class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {page.url.pathname === tab.href
				? 'bg-white text-slate-900 shadow-sm'
				: 'text-slate-500 hover:text-slate-700'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>

{@render children()}
