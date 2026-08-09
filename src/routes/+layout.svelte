<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { display } from '$lib/display.svelte';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Restore dark mode from localStorage and sync state
	$effect(() => {
		if (!browser) return;
		display.dark = localStorage.getItem('dark') === 'true';
	});

	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.toggle('dark', display.dark);
		localStorage.setItem('dark', String(display.dark));
	});

	const nav = [
		{ href: '/dashboard', label: 'Dashboard', icon: '📊' },
		{ href: '/transactions', label: 'Lançamentos', icon: '💳' },
		{ href: '/previsto', label: 'Previsto', icon: '🎯' },
		{ href: '/fechamento', label: 'Fechamento', icon: '📋' },
		{ href: '/import', label: 'Importar', icon: '📥' },
		{ href: '/categories', label: 'Categorias', icon: '🏷️' },
		{ href: '/settings', label: 'Configurações', icon: '⚙️' }
	];
</script>

<div class="flex h-screen bg-slate-50">
	<aside class="flex w-60 flex-col border-r border-slate-200 bg-white">
		<div class="border-b border-slate-100 px-5 py-5">
			<div class="text-lg font-bold text-slate-900">💰 Controle</div>
			<div class="text-xs text-slate-400">Finanças Pessoais</div>
		</div>
		<nav class="flex-1 space-y-0.5 p-3">
			{#each nav as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
					       {page.url.pathname.startsWith(item.href)
						? 'bg-indigo-50 text-indigo-700'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<span class="text-base">{item.icon}</span>
					{item.label}
				</a>
			{/each}
		</nav>
		<div class="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">v0.1.0 — local</div>
	</aside>

	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>

