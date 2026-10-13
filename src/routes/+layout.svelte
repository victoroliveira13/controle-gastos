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
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/transactions', label: 'Lançamentos' },
		{ href: '/previsto', label: 'Previsto' },
		{ href: '/metas', label: 'Metas' },
		{ href: '/fechamento', label: 'Fechamento' },
		{ href: '/import', label: 'Importar' },
		{ href: '/categories', label: 'Categorias' },
		{ href: '/settings', label: 'Configurações' }
	];
</script>

<div class="flex h-screen flex-col bg-[#eaebee] dark:bg-[#171f2e]">
	<header
		class="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#f9f9f9] px-3.5 py-2 dark:bg-[#1e2839]"
	>
		<div class="flex min-w-0 items-center gap-2.5">
			<div class="grid h-[30px] w-[30px] flex-none place-items-center rounded-[7px] bg-[#2b3a54] text-white">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
				</svg>
			</div>
			<div>
				<div class="whitespace-nowrap text-[15px] font-semibold tracking-tight text-slate-700">Controle de Gastos</div>
				<small class="block text-[11px] font-medium text-slate-400">Finanças pessoais</small>
			</div>
		</div>

		<nav class="flex flex-wrap items-end self-stretch" aria-label="Principal">
			{#each nav as item}
				<a
					href={item.href}
					class="-mb-[9px] border-b-2 px-[15px] py-[9px] text-[13px] font-semibold transition-colors
					       {page.url.pathname.startsWith(item.href)
						? 'border-indigo-600 text-indigo-600'
						: 'border-transparent text-slate-400 hover:text-slate-700'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="flex-1"></div>

		<span class="whitespace-nowrap px-1 text-xs font-semibold text-slate-400">v0.1.0 — local</span>
		<button
			type="button"
			onclick={() => (display.dark = !display.dark)}
			class="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-indigo-600 hover:text-slate-700"
			title={display.dark ? 'Modo claro' : 'Modo escuro'}
			aria-label={display.dark ? 'Modo claro' : 'Modo escuro'}
		>
			{#if display.dark}
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
			{:else}
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>
			{/if}
		</button>
	</header>

	<main class="view-in min-h-0 flex-1 overflow-auto">
		{@render children()}
	</main>
</div>
