<script lang="ts">
	import type { EChartsOption, SeriesOption } from 'echarts';
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
		const falta = -sobraAteSalario;
		if (falta <= 0) return '';
		const g = data.budgetVsActual
			.filter((b) => b.previsto - b.realizado >= falta)
			.sort((a, b) => a.previsto - a.realizado - (b.previsto - b.realizado))[0];
		return g ? g.groupName : '';
	});
	const fmtDate = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
	const sobraPlanejada = $derived(data.income - data.totalPrevisto);
	// Saldo no 1º dia do mês = saldo atual − (receitas − despesas) já lançadas no mês
	const saldoInicio = $derived(data.currentBalance - data.cashNet);
	// O que passou do previsto (não compensa com grupos que sobraram)
	const estouroTotal = $derived(data.totalRealizado + totalDisponivel - data.totalPrevisto);
	const nivel = $derived(sobraAteSalario < 0 ? 'falta' : 'ok');
	// Fluxo de caixa até o próximo salário: saldo após cada evento conhecido
	const fluxo = $derived.by(() => {
		const p = data.projection;
		if (!p) return [];
		const [y, m] = data.ym.split('-').map(Number);
		const fimMes = `${data.ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
		let saldo = data.currentBalance;
		const pts = [{ label: 'Hoje', date: data.balanceDate, delta: 0, saldo }];
		if (totalDisponivel > 0) {
			saldo -= totalDisponivel;
			pts.push({ label: 'Gastos previstos que faltam no mês', date: fimMes, delta: -totalDisponivel, saldo });
		}
		for (const d of p.dues) {
			saldo -= d.amount;
			pts.push({ label: d.name, date: d.due, delta: -d.amount, saldo });
		}
		if (p.salaryAmount > 0) {
			saldo += p.salaryAmount;
			pts.push({ label: 'Salário previsto', date: p.salaryDate, delta: p.salaryAmount, saldo });
		}
		return pts;
	});
	const primeiroNegativo = $derived(fluxo.find((pt) => pt.saldo < 0));
	const fatorAjuste =$derived(totalDisponivel > 0 ? saldoLimite / totalDisponivel : 1);

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

	// média acumulada até cada mês, a partir do primeiro mês com valor
	const runningAvg = (arr: number[]) => {
		const start = arr.findIndex((v) => v !== 0);
		let sum = 0;
		return arr.map((v, i) =>
			start === -1 || i < start ? null : Math.round(((sum += v) / (i - start + 1)) * 100) / 100
		);
	};

	// Despesa prevista do mês = já gasto + o que ainda falta gastar do planejado
	// Filtro do gráfico de evolução: 'todos' ou o código de um grupo
	let evoGroup = $state('todos');
	const evoGrupo = $derived(data.budgetVsActual.find((b) => b.groupCode === evoGroup) ?? null);
	const evoGastoMes = $derived(evoGroup === 'todos' ? data.expense : (data.expenseByGroup[evoGroup]?.[data.ym] ?? 0));
	const evoExpenseArr = $derived(
		evoGroup === 'todos' ? data.expenseArr : data.months.map((m) => data.expenseByGroup[evoGroup]?.[m] ?? 0)
	);
	const despesaPrevista = $derived(
		evoGroup === 'todos'
			? data.totalRealizado + totalDisponivel
			: Math.max(evoGrupo?.previsto ?? 0, evoGrupo?.realizado ?? 0)
	);
	// Só a parte que falta, empilhada sobre a barra de despesas do mês selecionado
	const faltaPrevistaArr = $derived(
		data.months.map((m) => (m === data.ym ? Math.max(despesaPrevista - evoGastoMes, 0) : null))
	);

	// Receita prevista do mês = o que foi provisionado em Previsto; só a parte que falta entra empilhada
	const receitaPrevista = $derived(Math.max(data.incomeForecast, data.income));
	const faltaReceitaArr = $derived(
		data.months.map((m) => (m === data.ym ? Math.max(data.incomeForecast - data.income, 0) : null))
	);

	// Zoom do gráfico: meses visíveis (índices em data.months). null = sem zoom aplicado
	let evoZoom = $state<{ from: number; to: number } | null>(null);
	$effect(() => {
		evoGroup;
		data;
		evoZoom = null;
	});
	function onEvoZoom(z: { start: number; end: number; startValue?: number; endValue?: number }) {
		if (z.startValue != null && z.endValue != null) {
			evoZoom = { from: z.startValue, to: z.endValue };
		} else {
			const n = data.months.length;
			const from = Math.floor((z.start / 100) * n);
			evoZoom = { from, to: Math.max(from, Math.ceil((z.end / 100) * n) - 1) };
		}
	}
	// Total do grupo: no ano do mês selecionado, ou nos meses visíveis quando há zoom
	const evoTotal = $derived(
		evoZoom
			? evoExpenseArr.slice(evoZoom.from, evoZoom.to + 1).reduce((s, v) => s + v, 0)
			: Object.entries(data.expenseByGroup[evoGroup] ?? {})
					.filter(([m]) => m.startsWith(data.ym.slice(0, 4)))
					.reduce((s, [, v]) => s + v, 0)
	);
	const evoTotalLabel = $derived(
		evoZoom ? `nos ${evoZoom.to - evoZoom.from + 1} meses visíveis` : `no ano ${data.ym.slice(0, 4)}`
	);

	// Receita só aparece sem filtro de grupo
	const mostraReceita = $derived(evoGroup === 'todos');
	const seriesReceita = ['Receitas', 'Receita prevista', 'Média receitas'];

	const evolutionOption = $derived<EChartsOption>({
		tooltip: { trigger: 'axis', valueFormatter: (v) => (typeof v === 'number' ? formatBRL(v) : '—') },
		legend: {
			data: ['Receitas', 'Receita prevista', 'Despesas', 'Despesa prevista', 'Média receitas', 'Média despesas'].filter(
				(n) => mostraReceita || !seriesReceita.includes(n)
			),
			bottom: 0
		},
		grid: { left: 60, right: 16, top: 16, bottom: 40 },
			// Roda aproxima/afasta; mínimo 3 meses, máximo 1 ano. Abre mostrando os últimos 12 meses
			dataZoom: [
				{
					type: 'inside',
					xAxisIndex: 0,
					minValueSpan: 3,
					maxValueSpan: 12,
					startValue: Math.max(data.months.length - 12, 0),
					endValue: data.months.length - 1,
					filterMode: 'filter'
				}
			],
		xAxis: {
			type: 'category',
			data: data.months.map((m) => monthLabel(m)),
			axisLabel: { fontSize: 11 }
		},
		yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `R$${(v / 1000).toFixed(0)}k`, fontSize: 11 } },
		series: (<SeriesOption[]>[
			{ name: 'Receitas', type: 'bar', stack: 'receita', data: data.incomeArr, itemStyle: { color: '#157a00' }, barMaxWidth: 28 },
			{
				name: 'Receita prevista',
				type: 'bar',
				stack: 'receita',
				data: faltaReceitaArr,
				itemStyle: { color: '#06b6d4', opacity: 0.3 },
				barMaxWidth: 28,
				tooltip: { valueFormatter: (v) => (typeof v === 'number' ? formatBRL(receitaPrevista) : '—') }
			},
			{ name: 'Despesas', type: 'bar', stack: 'despesa', data: evoExpenseArr, itemStyle: { color: '#b23a4e' }, barMaxWidth: 28 },
			{
				name: 'Despesa prevista',
				type: 'bar',
				stack: 'despesa',
				data: faltaPrevistaArr,
				itemStyle: { color: '#06b6d4', opacity: 0.3 },
				barMaxWidth: 28,
				tooltip: { valueFormatter: (v) => (typeof v === 'number' ? formatBRL(despesaPrevista) : '—') }
			},
			{ name: 'Média receitas', type: 'line', data: runningAvg(data.incomeArr), itemStyle: { color: '#22c55e' }, smooth: true, symbolSize: 5 },
			{ name: 'Média despesas', type: 'line', data: runningAvg(evoExpenseArr), itemStyle: { color: '#ef4444' }, smooth: true, symbolSize: 5 }
		]).filter((s) => mostraReceita || !seriesReceita.includes(String(s.name)))
	});

	const pieOption = $derived<EChartsOption>({
		tooltip: { trigger: 'item', formatter: (params) => {
			const p = params as { name: string; value: number; percent: number };
			return `${p.name}<br/>${formatBRL(p.value)} (${p.percent.toFixed(1)}%)`;
		} },
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
	<div class="mb-7 rounded-xl border bg-white shadow-sm {nivel === 'ok' ? 'border-emerald-200' : 'border-red-300'}">
		<div class="rounded-t-xl px-5 py-3 {nivel === 'ok' ? 'bg-emerald-50' : 'bg-red-50'}">
			<div class="flex items-center justify-between">
				{#if nivel === 'ok'}
					<div class="font-semibold text-emerald-700">✓ Sobram {fmt(sobraAteSalario)} até o salário, depois de pagar tudo</div>
				{:else}
					<div class="font-semibold text-red-700">🚨 Você precisa economizar {fmt(-sobraAteSalario)} até {fmtDate(data.projection.salaryDate)}</div>
				{/if}
				<div class="text-xs text-slate-500">próximo salário: {fmtDate(data.projection.salaryDate)}</div>
			</div>
			{#if nivel !== 'ok' && dicaCorte}
				<div class="mt-1 text-xs text-red-600">Cortar {fmt(-sobraAteSalario)} de {dicaCorte} resolve.</div>
			{/if}
			<div>
				{#if data.projection.dues.length > 0}
					<div class="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-slate-200">
						<div class="font-semibold text-slate-800">
							💰 Separe {fmt(contasAteSalario)} do saldo antes de gastar o resto
						</div>
						{#each data.projection.dues as d}
							<div class="mt-0.5 flex justify-between text-slate-700">
								<span>{d.name} <span class="text-xs text-slate-500">· vence {fmtDate(d.due)}{d.daysLeft >= 0 ? `, em ${d.daysLeft} dia${d.daysLeft === 1 ? '' : 's'}` : ''}</span></span>
								<span class="font-medium">{fmt(d.amount)}</span>
							</div>
						{/each}
						{#if saldoVirada < contasAteSalario}
							<div class="mt-1 text-xs font-medium text-red-600">
								O saldo na virada ({fmt(saldoVirada)}) não cobre {fmt(contasAteSalario - Math.max(saldoVirada, 0))} dessas contas.
							</div>
						{/if}
					</div>
				{/if}
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
		{#if fluxo.length > 1}
			<div class="border-t border-slate-100 px-5 py-3">
				<div class="mb-1 flex items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase">
					<span>Fluxo de caixa até o salário</span>
					{#if primeiroNegativo}
						<span class="font-semibold text-red-600 normal-case">⚠ conta negativa em {fmtDate(primeiroNegativo.date)}</span>
					{:else}
						<span class="font-semibold text-emerald-600 normal-case">sem saldo negativo</span>
					{/if}
				</div>
				<div class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-4 gap-y-0.5 text-sm">
					{#each fluxo as pt}
						<span class="text-xs text-slate-400">{fmtDate(pt.date)}</span>
						<span class="text-slate-600">{pt.label}</span>
						<span class="text-right text-xs {pt.delta < 0 ? 'text-red-500' : 'text-emerald-600'}">{pt.delta === 0 ? '' : fmt(pt.delta)}</span>
						<span class="w-28 text-right font-medium {pt.saldo < 0 ? 'text-red-600' : 'text-slate-800'}">{fmt(pt.saldo)}</span>
					{/each}
				</div>
				{#if !data.projection?.salaryAmount}
					<div class="mt-1 text-xs text-slate-400">Cadastre a receita prevista do mês em Previsto para ver quando a conta volta ao positivo.</div>
				{/if}
			</div>
		{/if}
	</div>
	{/if}

	<!-- Charts -->
	<div class="mb-7 grid grid-cols-5 gap-5">
		<div class="col-span-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-4 flex items-center justify-between gap-3">
				<span class="text-sm font-semibold text-slate-700">Evolução mensal</span>
				<div class="flex items-center gap-3">
					{#if evoGroup !== 'todos'}
						<span class="text-xs text-slate-500">{formatBRL(evoTotal)} <span class="text-slate-400">{evoTotalLabel}</span></span>
					{/if}
					<select bind:value={evoGroup} class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
					<option value="todos">Todos os grupos</option>
					{#each data.groupOptions as g (g.code)}
						<option value={g.code}>{g.name}</option>
					{/each}
				</select>
				</div>
			</div>
			<EChart option={evolutionOption} height="260px" onzoom={onEvoZoom} />
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

</div>
