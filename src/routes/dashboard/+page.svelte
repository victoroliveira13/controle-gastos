<script lang="ts">
	import EChart from '$lib/components/EChart.svelte';
	import { formatBRL, monthLabel, prevMonth, nextMonth, GROUP_COLORS } from '$lib/utils/format';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const balance = $derived(data.income - data.expense);

	const evolutionOption = $derived({
		tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatBRL(v) },
		legend: { data: ['Receitas', 'Despesas'], bottom: 0 },
		grid: { left: 60, right: 16, top: 16, bottom: 40 },
		xAxis: {
			type: 'category',
			data: data.months.map((m) => monthLabel(m)),
			axisLabel: { fontSize: 11 }
		},
		yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `R$${(v / 1000).toFixed(0)}k`, fontSize: 11 } },
		series: [
			{ name: 'Receitas', type: 'bar', data: data.incomeArr, itemStyle: { color: '#10b981' }, barMaxWidth: 28 },
			{ name: 'Despesas', type: 'bar', data: data.expenseArr, itemStyle: { color: '#ef4444' }, barMaxWidth: 28 }
		]
	});

	const pieOption = $derived({
		tooltip: { trigger: 'item', formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/>${formatBRL(p.value)} (${p.percent.toFixed(1)}%)` },
		series: [
			{
				type: 'pie',
				radius: ['42%', '70%'],
				center: ['50%', '50%'],
				data: data.pieBreakdown.map((b) => ({
					name: b.groupName,
					value: b.total,
					itemStyle: { color: GROUP_COLORS[b.groupCode] ?? '#94a3b8' }
				})),
				label: { show: false },
				emphasis: { label: { show: false } }
			}
		]
	});

	const pieTotal = $derived(data.pieBreakdown.reduce((s, b) => s + b.total, 0));

	function updatePieRange(field: 'pieFrom' | 'pieTo', value: string) {
		const params = new URLSearchParams(window.location.search);
		params.set('month', data.ym);
		params.set(field, value);
		if (!params.get('pieFrom')) params.set('pieFrom', data.pieFrom);
		if (!params.get('pieTo')) params.set('pieTo', data.pieTo);
		goto(`/dashboard?${params.toString()}`);
	}

	import { display } from '$lib/display.svelte';

	const fmt = $derived((v: number) => display.hidden ? '••••••' : formatBRL(v));

	function navigate(dir: 'prev' | 'next') {
		const m = dir === 'prev' ? prevMonth(data.ym) : nextMonth(data.ym);
		goto(`/dashboard?month=${m}`);
	}
</script>

<div class="p-8">
	<!-- Header -->
	<div class="mb-7 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
		<div class="flex items-center gap-2">
			<button onclick={() => (display.hidden = !display.hidden)} class="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600" title={display.hidden ? 'Mostrar valores' : 'Ocultar valores'}>
				{#if display.hidden}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
				{/if}
			</button>
			<button onclick={() => (display.dark = !display.dark)} class="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600" title={display.dark ? 'Modo claro' : 'Modo escuro'}>
				{#if display.dark}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				{/if}
			</button>
			<button onclick={() => navigate('prev')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">←</button>
			<span class="w-28 text-center text-sm font-medium text-slate-700">{monthLabel(data.ym)}</span>
			<button onclick={() => navigate('next')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">→</button>
		</div>
	</div>

	<!-- Summary cards -->
	<div class="mb-7 grid grid-cols-3 gap-5">
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Receitas</div>
			<div class="text-2xl font-bold text-emerald-600">{fmt(data.income)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Despesas</div>
			<div class="text-2xl font-bold text-red-600">{fmt(data.expense)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Saldo</div>
			<div class="text-2xl font-bold {balance >= 0 ? 'text-emerald-600' : 'text-red-600'}">{fmt(balance)}</div>
		</div>
	</div>

	<!-- Charts -->
	<div class="mb-7 grid grid-cols-5 gap-5">
		<div class="col-span-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-4 text-sm font-semibold text-slate-700">Evolução mensal</div>
			<EChart option={evolutionOption} height="260px" />
		</div>
		<div class="col-span-2 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-semibold text-slate-700">Despesas por grupo</span>
				<div class="flex items-center gap-1.5 text-xs text-slate-500">
					<input
						type="month"
						value={data.pieFrom}
						onchange={(e) => updatePieRange('pieFrom', (e.target as HTMLInputElement).value)}
						class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
					/>
					<span>até</span>
					<input
						type="month"
						value={data.pieTo}
						onchange={(e) => updatePieRange('pieTo', (e.target as HTMLInputElement).value)}
						class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
					/>
				</div>
			</div>
			{#if data.pieBreakdown.length === 0}
				<div class="flex h-60 items-center justify-center text-sm text-slate-400">Sem despesas no período</div>
			{:else}
				<div class="flex items-center gap-4">
					<div class="w-44 shrink-0">
						<EChart option={pieOption} height="176px" />
					</div>
					<div class="flex-1 space-y-1.5 overflow-auto max-h-52">
						{#each data.pieBreakdown as b}
							{@const pct = pieTotal > 0 ? (b.total / pieTotal) * 100 : 0}
							{@const color = GROUP_COLORS[b.groupCode] ?? '#94a3b8'}
							<div class="flex items-center gap-2 text-xs">
								<div class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{color}"></div>
								<span class="flex-1 truncate text-slate-700">{b.groupName}</span>
								<span class="font-medium text-slate-800">{formatBRL(b.total)}</span>
								<span class="w-10 text-right text-slate-400">{pct.toFixed(1)}%</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Previsto vs Realizado -->
	{#if data.budgetVsActual.length > 0}
	<div class="mb-7 rounded-xl border border-slate-100 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
			<span class="text-sm font-semibold text-slate-700">Previsto vs Realizado</span>
			<a href="/previsto?month={data.ym}" class="text-xs text-indigo-600 hover:underline">Editar →</a>
		</div>
		<div class="divide-y divide-slate-50 px-5 py-2">
			{#each data.budgetVsActual as b}
				{@const color = GROUP_COLORS[b.groupCode] ?? '#94a3b8'}
				{@const pct = b.previsto > 0 ? Math.min((b.realizado / b.previsto) * 100, 100) : 100}
				{@const over = b.previsto > 0 && b.realizado > b.previsto}
				{@const href = `/transactions?month=${data.ym}&${b.categoryIds.map((id) => `categoryId=${id}`).join('&')}`}
				<div
					role="button"
					tabindex="0"
					onclick={() => goto(href)}
					onkeydown={(e) => e.key === 'Enter' && goto(href)}
					class="cursor-pointer py-3 hover:bg-slate-50 -mx-5 px-5 rounded transition-colors"
				>
					<div class="mb-1.5 flex items-center justify-between text-sm">
						<div class="flex items-center gap-2">
							<div class="h-2.5 w-2.5 rounded-full" style="background:{color}"></div>
							<span class="font-medium text-slate-700">{b.groupName}</span>
							{#if over}
								<span class="text-xs font-semibold text-red-500">+{formatBRL(b.realizado - b.previsto)} acima</span>
							{:else if b.previsto > 0}
								<span class="text-xs font-semibold text-emerald-600">{formatBRL(b.previsto - b.realizado)} disponível</span>
							{/if}
						</div>
						<div class="flex items-center gap-3 text-xs">
							<span class="text-slate-400">Previsto: {formatBRL(b.previsto)}</span>
							<span class="{over ? 'font-semibold text-red-600' : 'text-slate-600'}">
								{over ? '⚠ ' : ''}{formatBRL(b.realizado)}
							</span>
						</div>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
						{#if b.previsto === 0}
							<div class="h-2 w-full rounded-full bg-red-400"></div>
						{:else}
							<div
								class="h-2 rounded-full transition-all"
								style="width:{pct}%; background:{over ? '#ef4444' : color}"
							></div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
		<div class="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
			<span class="text-slate-500">Total previsto: <span class="font-semibold text-slate-700">{formatBRL(data.totalPrevisto)}</span></span>
			<span class="text-slate-500">Total realizado: <span class="font-semibold {data.totalRealizado > data.totalPrevisto ? 'text-red-600' : 'text-emerald-600'}">{formatBRL(data.totalRealizado)}</span></span>
		</div>
	</div>
	{:else}
	<div class="mb-7 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center">
		<p class="text-sm text-slate-500">Nenhum orçamento definido para {monthLabel(data.ym)}.</p>
		<a href="/previsto?month={data.ym}" class="mt-1 inline-block text-sm text-indigo-600 hover:underline">Definir previsto →</a>
	</div>
	{/if}

	<!-- Fechamento do mês -->
	<a
		href="/fechamento?month={data.ym}"
		class="mt-5 flex items-center justify-between rounded-xl border px-6 py-4 shadow-sm transition-colors {data.hasNotes ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'border-indigo-100 bg-white hover:bg-indigo-50'}"
	>
		<div class="flex items-center gap-3">
			<span class="text-2xl">{data.hasNotes ? '✅' : '📋'}</span>
			<div>
				<div class="font-semibold {data.hasNotes ? 'text-emerald-800' : 'text-slate-800'}">Fechamento de {monthLabel(data.ym)}</div>
				<div class="text-xs {data.hasNotes ? 'text-emerald-600' : 'text-slate-400'}">{data.hasNotes ? 'Preenchido — clique para editar' : 'Registrar imprevistos, gastos supérfluos e plano de ação'}</div>
			</div>
		</div>
		<span class="text-sm font-medium {data.hasNotes ? 'text-emerald-700' : 'text-indigo-600'}">{data.hasNotes ? 'Editar →' : 'Preencher →'}</span>
	</a>

</div>
