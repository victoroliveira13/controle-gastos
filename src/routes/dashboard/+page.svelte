<script lang="ts">
	import EChart from '$lib/components/EChart.svelte';
	import { formatBRL, monthLabel, prevMonth, nextMonth, GROUP_COLORS } from '$lib/utils/format';
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const balance = $derived(data.income - data.expense);

	// Disponível do orçamento (previsto - realizado, sem compensar grupos estourados)
	// não pode superar o saldo do mês; se superar, o previsto precisa ser ajustado.
	const totalDisponivel = $derived(
		data.budgetVsActual.reduce((s, b) => s + Math.max(b.previsto - b.realizado, 0), 0)
	);
	const saldoLimite = $derived(Math.max(balance, 0));
	const excedente = $derived(Math.max(totalDisponivel - saldoLimite, 0));
	const estourados = $derived(data.budgetVsActual.filter((b) => b.previsto > 0 && b.realizado > b.previsto).length);
	let showDetalhes = $state(false);

	// Projeção até o próximo salário
	const saldoVirada = $derived(data.currentBalance - totalDisponivel);
	const contasAteSalario = $derived((data.projection?.dues ?? []).reduce((s, d) => s + d.amount, 0));
	const sobraAteSalario = $derived(saldoVirada - contasAteSalario);
	// Menor grupo cujo "disponível" sozinho cobre a falta
	const dicaCorte = $derived.by(() => {
		const falta = cushion - sobraAteSalario;
		if (falta <= 0) return '';
		const g = data.budgetVsActual
			.filter((b) => b.previsto - b.realizado >= falta)
			.sort((a, b) => a.previsto - a.realizado - (b.previsto - b.realizado))[0];
		return g ? g.groupName : '';
	});
	const fmtDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
	const cushion = $derived(Number(data.projection?.cushion) > 0 ? Number(data.projection?.cushion) : 300);
	const sobraPlanejada = $derived(data.income - data.totalPrevisto);
	// Saldo no 1º dia do mês = saldo atual − (receitas − despesas) já lançadas no mês
	const saldoInicio = $derived(data.currentBalance - balance);
	// O que passou do previsto (não compensa com grupos que sobraram)
	const estouroTotal = $derived(data.expense + totalDisponivel - data.totalPrevisto);
	const nivel =$derived(
		sobraAteSalario < 0 ? 'falta' : sobraAteSalario < cushion ? 'atencao' : 'ok'
	);
	const progressoColchao = $derived(
		Math.max(0, Math.min(100, (sobraAteSalario / cushion) * 100))
	);
	const fatorAjuste = $derived(totalDisponivel > 0 ? saldoLimite / totalDisponivel : 1);

	// Cobrir gasto: lança despesa e sobe o previsto só pela diferença
	type CoverGroup = (typeof data.budgetVsActual)[number];
	let cover = $state<CoverGroup | null>(null);
	let coverCents = $state(0);
	let coverCatId = $state<number | null>(null);
	let coverDesc = $state('');
	let coverSaving = $state(false);
	let coverError = $state('');

	const coverAmount = $derived(coverCents / 100);
	const coverFalta = $derived(
		cover ? Math.max(Math.round((cover.realizado + coverAmount - cover.previsto) * 100) / 100, 0) : 0
	);
	// Efeito no limite: disponível total após cobrir vs saldo do mês
	const coverDisponivelApos = $derived(
		cover
			? data.budgetVsActual.reduce((s, b) => {
					const prev = b.groupId === cover!.groupId ? b.previsto + coverFalta : b.previsto;
					const real = b.groupId === cover!.groupId ? b.realizado + coverAmount : b.realizado;
					return s + Math.max(prev - real, 0);
				}, 0)
			: 0
	);
	// Despesa nova reduz o saldo do mês; disponível após cobrir não pode superá-lo
	const coverEstoura = $derived(coverDisponivelApos > Math.max(balance - coverAmount, 0));

	let showCoverMore = $state(false);

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	function openCover(b: CoverGroup) {
		showCoverMore = false;
		cover = b;
		coverCents = 0;
		coverDesc = '';
		coverError = '';
		coverCatId = b.defaultCoverCategoryId;
	}

	function coverKey(e: KeyboardEvent) {
		if (e.key >= '0' && e.key <= '9') {
			e.preventDefault();
			coverCents = coverCents * 10 + parseInt(e.key);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			coverCents = Math.floor(coverCents / 10);
		} else if (e.key === 'Escape') {
			cover = null;
		}
	}

	async function submitCover() {
		if (!cover || !coverCatId || coverAmount <= 0) return;
		coverSaving = true;
		coverError = '';
		const fd = new FormData();
		fd.append('categoryId', String(coverCatId));
		fd.append('amount', String(coverAmount));
		fd.append('description', coverDesc);
		const res = await fetch(`?/cobrir&month=${data.ym}`, { method: 'POST', body: fd });
		coverSaving = false;
		if (!res.ok) {
			coverError = 'Erro ao salvar';
			return;
		}
		cover = null;
		await invalidateAll();
	}

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
			{ name: 'Receitas', type: 'bar', data: data.incomeArr, itemStyle: { color: '#157a00' }, barMaxWidth: 28 },
			{ name: 'Despesas', type: 'bar', data: data.expenseArr, itemStyle: { color: '#b23a4e' }, barMaxWidth: 28 }
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
	<div class="mb-7 grid grid-cols-4 gap-5">
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Receitas</div>
			<div class="text-2xl font-bold text-emerald-600">{fmt(data.income)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Despesas</div>
			<div class="text-2xl font-bold text-red-600">{fmt(data.expense)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Saldo do mês</div>
			<div class="text-2xl font-bold {balance >= 0 ? 'text-emerald-600' : 'text-red-600'}">{fmt(balance)}</div>
		</div>
		<div class="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">{data.balanceIsToday ? 'Saldo atual' : 'Saldo final'}</div>
			<div class="text-2xl font-bold {data.currentBalance >= 0 ? 'text-indigo-700' : 'text-red-600'}">{fmt(data.currentBalance)}</div>
			<div class="mt-1 text-xs text-slate-400">
				em conta {data.balanceIsToday ? 'hoje' : 'em'} {data.balanceDate.split('-').reverse().join('/')}
			</div>
		</div>
	</div>

	<!-- Projeção até o próximo salário -->
	{#if data.projection}
	<div class="mb-7 rounded-xl border bg-white shadow-sm {nivel === 'ok' ? 'border-emerald-200' : nivel === 'atencao' ? 'border-amber-300' : 'border-red-300'}">
		<div class="rounded-t-xl px-5 py-3 {nivel === 'ok' ? 'bg-emerald-50' : nivel === 'atencao' ? 'bg-amber-50' : 'bg-red-50'}">
			<div class="flex items-center justify-between">
				{#if nivel === 'ok'}
					<div class="font-semibold text-emerald-700">✓ Colchão completo: sobram {fmt(sobraAteSalario)} depois de pagar tudo</div>
				{:else if nivel === 'atencao'}
					<div class="font-semibold text-amber-700">⚠ Fecha sem margem: sobram só {fmt(sobraAteSalario)}. Qualquer imprevisto estoura</div>
				{:else}
					<div class="font-semibold text-red-700">🚨 Você precisa economizar {fmt(-sobraAteSalario)} até {fmtDate(data.projection.salaryDate)}</div>
				{/if}
				<div class="text-xs text-slate-500">próximo salário: {fmtDate(data.projection.salaryDate)}</div>
			</div>
			{#if nivel !== 'ok'}
				<div class="mt-1 text-xs {nivel === 'atencao' ? 'text-amber-700' : 'text-red-600'}">
					Faltam {fmt(cushion - sobraAteSalario)} para o colchão de {fmt(cushion)}.
					{#if dicaCorte}Cortar {fmt(cushion - sobraAteSalario)} de {dicaCorte} resolve.{/if}
				</div>
			{/if}
			<div class="mt-2 flex items-center gap-3">
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200">
					<div class="h-full rounded-full {nivel === 'ok' ? 'bg-emerald-500' : nivel === 'atencao' ? 'bg-amber-500' : 'bg-red-500'}" style="width:{progressoColchao}%"></div>
				</div>
				<span class="text-xs font-medium text-slate-600">Colchão {fmt(sobraAteSalario)} de {fmt(cushion)}</span>
			</div>
		</div>
		<div class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-5 py-3 text-sm">
			<span class="text-slate-600">Saldo que veio do mês passado <span class="text-xs text-slate-400">(em conta hoje {fmt(data.currentBalance)} − o que já entrou e saiu neste mês)</span></span>
			<span class="text-right font-medium text-slate-800">{fmt(saldoInicio)}</span>
			<span class="text-slate-600">+ Salário</span>
			<span class="text-right font-medium text-slate-800">{fmt(data.income)}</span>
			<span class="text-slate-600">− Previsto do mês <span class="text-xs text-slate-400">({fmt(data.totalRealizado)} já gasto + {fmt(data.totalPrevisto - data.totalRealizado)} a gastar)</span></span>
			<span class="text-right font-medium text-slate-800">{fmt(data.totalPrevisto)}</span>
			{#if estouroTotal > 0.005}
				<span class="text-slate-600">− Grupos que passaram do previsto</span>
				<span class="text-right font-medium text-red-600">{fmt(estouroTotal)}</span>
			{/if}
			<span class="border-t border-slate-100 pt-1 font-medium text-slate-700">= Saldo na virada do mês</span>
			<span class="border-t border-slate-100 pt-1 text-right font-semibold {saldoVirada >= 0 ? 'text-indigo-700' : 'text-red-600'}">{fmt(saldoVirada)}</span>
			{#each data.projection.dues as d}
				<span class="text-slate-600">− {d.name} <span class="text-xs text-slate-400">(vence {fmtDate(d.due)})</span></span>
				<span class="text-right font-medium text-slate-800">{fmt(d.amount)}</span>
			{/each}
			<span class="border-t border-slate-100 pt-1 font-semibold text-slate-800">= Sobra até o salário</span>
			<span class="border-t border-slate-100 pt-1 text-right font-bold {sobraAteSalario >= 0 ? 'text-emerald-700' : 'text-red-600'}">{fmt(sobraAteSalario)}</span>
		</div>
	</div>
	{/if}

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
			<button type="button" onclick={() => (showDetalhes = !showDetalhes)} class="flex items-center gap-2 text-sm font-semibold text-slate-700">
				<span class="text-xs text-slate-400">{showDetalhes ? '▼' : '▶'}</span>
				Previsto vs Realizado
				<span class="text-xs font-normal text-slate-400">
					{fmt(data.totalRealizado)} de {fmt(data.totalPrevisto)}{#if estourados > 0} · <span class="text-red-600">{estourados} acima do previsto</span>{/if}
				</span>
			</button>
			<a href="/previsto?month={data.ym}" class="text-xs text-indigo-600 hover:underline">Editar →</a>
		</div>
		<div class="flex items-center justify-between border-b border-slate-100 px-5 py-2.5 text-sm">
			<span class="text-slate-600">
				Salário <span class="font-medium text-slate-800">{fmt(data.income)}</span>
				− Previsto <span class="font-medium text-slate-800">{fmt(data.totalPrevisto)}</span>
			</span>
			<span class="font-semibold {sobraPlanejada >= 0 ? 'text-emerald-700' : 'text-red-600'}">
				= {sobraPlanejada >= 0 ? 'sobra planejada do mês' : 'falta planejada do mês'} {fmt(Math.abs(sobraPlanejada))}
				<span class="block text-right text-xs font-normal text-slate-400">sem o saldo anterior e sem o financiamento de 01/11</span>
			</span>
		</div>
		{#if !data.projection}
		<div class="flex items-center justify-between border-b px-5 py-3 text-sm {excedente > 0 ? 'border-red-100 bg-red-50' : 'border-emerald-100 bg-emerald-50'}">
			<div>
				{#if excedente > 0}
					<div class="font-semibold text-red-700">⚠ Você planejou gastar {fmt(excedente)} a mais do que tem</div>
					<div class="text-xs text-red-600">Reduza o previsto dos grupos abaixo (valor sugerido em cada linha).</div>
				{:else}
					<div class="font-semibold text-emerald-700">✓ Tudo certo: o que falta gastar cabe no seu dinheiro</div>
					<div class="text-xs text-emerald-600">Depois de gastar todo o previsto, ainda sobram {fmt(saldoLimite - totalDisponivel)}.</div>
				{/if}
			</div>
		</div>
		{/if}
		<div class="divide-y divide-slate-50 px-5 py-2 {showDetalhes ? '' : 'hidden'}">
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
					<div class="mb-1.5 flex items-center gap-3 text-sm">
						<div class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{color}"></div>
						<span class="flex-1 truncate font-medium text-slate-700">{b.groupName}</span>
						{#if over}
							<span class="font-semibold text-red-600">{fmt(b.realizado - b.previsto)} acima</span>
						{:else if b.previsto > 0}
							<span class="font-semibold text-emerald-600">{fmt(b.previsto - b.realizado)} disponível</span>
						{/if}
						{#if b.defaultCoverCategoryId}
							<button
								type="button"
								onclick={(e) => { e.stopPropagation(); openCover(b); }}
								onkeydown={(e) => e.stopPropagation()}
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-200 text-base leading-none text-indigo-600 hover:bg-indigo-50"
								title="Lançar gasto neste grupo"
								aria-label="Lançar gasto em {b.groupName}"
							>+</button>
						{/if}
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
						{#if b.previsto === 0}
							<div class="h-2 w-full rounded-full bg-red-400"></div>
						{:else}
							<div
								class="h-2 rounded-full transition-all"
								style="width:{pct}%; background:{over ? '#b23a4e' : color}"
							></div>
						{/if}
					</div>
					<div class="mt-1 flex items-center justify-between text-xs text-slate-400">
						<span>{fmt(b.realizado)} de {fmt(b.previsto)}</span>
						{#if excedente > 0 && !over && b.previsto > b.realizado}
							<span class="font-medium text-amber-600">reduzir previsto para {fmt(b.realizado + (b.previsto - b.realizado) * fatorAjuste)}</span>
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

	{#if cover}
		{@const disp = cover.previsto - cover.realizado}
		{@const catName = cover.coverCategories.find((c) => c.id === coverCatId)?.name ?? ''}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="presentation" onclick={() => (cover = null)}>
			<div class="w-80 rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (cover = null)}>
				<div class="mb-4 flex items-baseline justify-between">
					<span class="font-semibold text-slate-900">{cover.groupName}</span>
					<span class="text-xs text-slate-500">disponível <span class="font-semibold {disp >= 0 ? 'text-emerald-600' : 'text-red-600'}">{formatBRL(disp)}</span></span>
				</div>

				<input
					use:focusOnMount
					readonly
					inputmode="numeric"
					aria-label="Valor do gasto"
					value={'R$ ' + coverAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
					onkeydown={(e) => { if (e.key === 'Enter') submitCover(); else coverKey(e); }}
					class="mb-3 w-full rounded-lg border border-slate-200 px-3 py-3 text-center text-2xl font-bold text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
				/>

				<div class="mb-4 min-h-10 text-center text-sm">
					{#if coverAmount === 0}
						<span class="text-slate-400">Digite o valor do gasto</span>
					{:else if coverFalta > 0}
						<span class="text-amber-700">Previsto sobe <span class="font-bold">{formatBRL(coverFalta)}</span></span>
					{:else}
						<span class="text-emerald-700">Já cabe no previsto</span>
					{/if}
					{#if coverEstoura}
						<div class="mt-1 text-xs font-semibold text-red-600">⚠ Passa do saldo do mês</div>
					{/if}
				</div>

				{#if showCoverMore}
					<select bind:value={coverCatId} aria-label="Categoria" class="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
						{#each cover.coverCategories as c}
							<option value={c.id}>{c.name}</option>
						{/each}
					</select>
					<input bind:value={coverDesc} placeholder="Descrição (opcional)" class="mb-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
				{:else}
					<button type="button" onclick={() => (showCoverMore = true)} class="mb-3 block w-full truncate text-center text-xs text-slate-400 hover:text-indigo-600">
						Lançar em <span class="font-medium">{catName}</span> · alterar
					</button>
				{/if}

				{#if coverError}
					<div class="mb-2 text-center text-xs font-semibold text-red-600">{coverError}</div>
				{/if}

				<div class="flex gap-2">
					<button type="button" onclick={() => (cover = null)} class="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
					<button
						type="button"
						onclick={submitCover}
						disabled={coverSaving || coverAmount <= 0 || !coverCatId}
						class="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
					>{coverSaving ? 'Salvando…' : 'Lançar'}</button>
				</div>
			</div>
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
