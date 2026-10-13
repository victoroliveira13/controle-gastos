<script lang="ts">
import { goto } from "$app/navigation";
import { formatBRL, monthLabel, prevMonth, nextMonth, GROUP_COLORS } from "$lib/utils/format";
import ConfirmModal from "$lib/components/ConfirmModal.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

// cents-based input state (calculator style)
let rawCents = $state<Record<number, number>>({});
let saving = $state<Record<number, boolean>>({});

let incomeCents = $state<number | null>(null);
let savingIncome = $state(false);

$effect(() => {
	void data.ym;
	rawCents = {};
	incomeCents = null;
});

const savedIncomeCents = $derived(Math.round((Number(data.incomeForecast) || 0) * 100));
const incomeForecast = $derived((incomeCents ?? savedIncomeCents) / 100);

function handleIncomeKey(e: KeyboardEvent) {
	const cur = incomeCents ?? savedIncomeCents;
	if (e.key >= '0' && e.key <= '9') {
		e.preventDefault();
		incomeCents = cur * 10 + parseInt(e.key);
	} else if (e.key === 'Backspace') {
		e.preventDefault();
		incomeCents = Math.floor(cur / 10);
	}
}

async function saveIncome() {
	savingIncome = true;
	const fd = new FormData();
	fd.append('amount', String(incomeForecast));
	await fetch(`?/saveIncome&month=${data.ym}`, { method: 'POST', body: fd });
	savingIncome = false;
}

function getCents(id: number): number {
	if (id in rawCents) return rawCents[id];
	for (const group of data.groups) {
		const cat = group.categories.find((c) => c.id === id);
		if (cat) return Math.round(cat.amount * 100);
	}
	return 0;
}

function displayValue(id: number): string {
	const cents = getCents(id);
	return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getAmount(id: number): number {
	return getCents(id) / 100;
}

function handleKey(e: KeyboardEvent, id: number) {
	if (e.key >= '0' && e.key <= '9') {
		e.preventDefault();
		rawCents[id] = getCents(id) * 10 + parseInt(e.key);
	} else if (e.key === 'Backspace') {
		e.preventDefault();
		rawCents[id] = Math.floor(getCents(id) / 10);
	}
}

let open = $state<Record<number, boolean>>({});

function isOpen(id: number) {
	return open[id] ?? false;
}

function groupTotal(g: typeof data.groups[number]) {
	return g.categories.reduce((s, c) => s + getAmount(c.id), 0);
}

const grandTotal = $derived.by(() => data.groups.reduce((s, g) => s + groupTotal(g), 0));

const sobra = $derived(incomeForecast - grandTotal);

function navigate(dir: "prev" | "next") {
	const m = dir === "prev" ? prevMonth(data.ym) : nextMonth(data.ym);
	goto(`/previsto?month=${m}`);
}

let copying = $state(false);
let showConfirm = $state(false);
let showClearConfirm = $state(false);

async function copyToNext() {
	if (data.nextHasBudget) { showConfirm = true; return; }
	await doCopy();
}

async function doCopy() {
	showConfirm = false;
	copying = true;
	await fetch(`?/copyToNext&month=${data.ym}`, { method: 'POST', body: new FormData() });
	copying = false;
	navigate("next");
}

async function clearGroup(groupId: number) {
	const group = data.groups.find((g) => g.id === groupId);
	if (group) for (const cat of group.categories) rawCents[cat.id] = 0;
	const fd = new FormData();
	fd.append('groupId', String(groupId));
	await fetch(`?/clearGroup&month=${data.ym}`, { method: 'POST', body: fd });
}

async function clearAll() {
	showClearConfirm = false;
	for (const group of data.groups) for (const cat of group.categories) rawCents[cat.id] = 0;
	incomeCents = 0;
	await fetch(`?/clearAll&month=${data.ym}`, { method: 'POST', body: new FormData() });
}

async function saveOne(catId: number) {
	saving[catId] = true;
	const val = getCents(catId) / 100;
	const fd = new FormData();
	fd.append('categoryId', String(catId));
	fd.append('amount', String(val));
	await fetch(`?/saveOne&month=${data.ym}`, { method: 'POST', body: fd });
	saving[catId] = false;
}
</script>

<div class="p-8">
<!-- Header -->
<div class="mb-7 flex items-center justify-between">
<div>
<h1 class="text-2xl font-bold text-slate-900">Previsto</h1>
<p class="mt-1 text-sm text-slate-500">Defina o orçamento mensal por categoria</p>
</div>
<div class="flex items-center gap-2">
<button onclick={() => navigate("prev")} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">←</button>
<span class="w-28 text-center text-sm font-medium text-slate-700">{monthLabel(data.ym)}</span>
<button onclick={() => navigate("next")} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">→</button>
<button
	onclick={copyToNext}
	disabled={copying}
	title="Copiar previsto para o próximo mês"
	class="ml-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
>
	{copying ? '⏳' : '📋'} <span class="text-slate-600">Copiar →</span>
</button>
<button
	onclick={() => (showClearConfirm = true)}
	title="Limpar todo o previsto deste mês"
	class="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-1.5"
>
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"/>
		<path d="M6.0 11.0 L13 18"/>
	</svg>
	<span>Limpar tudo</span>
</button>
</div>
</div>

<!-- Proventos previstos -->
<div class="mb-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-5 py-4 shadow-sm">
<div>
<div class="text-sm font-semibold text-slate-800">Proventos previstos</div>
<div class="text-xs text-slate-500">Quanto você espera receber em {monthLabel(data.ym)}</div>
</div>
<div class="flex items-center gap-1.5">
{#if savingIncome}
<span class="text-xs text-slate-400">💾</span>
{/if}
<span class="text-xs text-slate-400">R$</span>
<input
readonly
inputmode="numeric"
value={incomeForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
onkeydown={handleIncomeKey}
onblur={saveIncome}
class="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm font-semibold text-emerald-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
placeholder="0,00"
/>
</div>
</div>

<div class="space-y-3">
{#each data.groups.filter((g) => g.categories.length > 0) as group}
{@const color = GROUP_COLORS[group.code] ?? "#94a3b8"}
{@const subtotal = groupTotal(group)}

<div class="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
<div
	role="button"
	tabindex="0"
	onclick={() => (open[group.id] = !isOpen(group.id))}
	onkeydown={(e) => e.key === 'Enter' && (open[group.id] = !isOpen(group.id))}
	class="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
>
<div class="flex items-center gap-3">
<div class="h-3 w-3 rounded-full flex-shrink-0" style="background:{color}"></div>
<span class="text-sm font-semibold text-slate-800">{group.name}</span>
</div>
<div class="flex items-center gap-3" onclick={(e) => e.stopPropagation()}>
{#if subtotal > 0}
<span class="text-sm font-medium text-slate-600">{formatBRL(subtotal)}</span>
{/if}
<button
	type="button"
	onclick={() => clearGroup(group.id)}
	title="Limpar previsto deste grupo"
	class="rounded p-1 text-slate-400 transition-colors"
>
	<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M20 20H7L3 16l10-10 7 7-3.5 3.5"/>
		<path d="M6.0 11.0 L13 18"/>
	</svg>
</button>
<span class="text-slate-400 text-base inline-block transition-transform {isOpen(group.id) ? '' : '-rotate-90'}">▾</span>
</div>
</div>

{#if isOpen(group.id)}
<div class="border-t border-slate-100">
{#each group.categories as cat, i}
<div class="flex items-center gap-3 px-5 py-2.5 {i < group.categories.length - 1 ? 'border-b border-slate-50' : ''}">
<span class="w-8 text-xs font-mono text-slate-400">{cat.code}</span>
<span class="flex-1 text-sm text-slate-700">{cat.name}</span>
<div class="flex items-center gap-1.5">
{#if saving[cat.id]}
<span class="text-xs text-slate-400">💾</span>
{/if}
<span class="text-xs text-slate-400">R$</span>
<input
readonly
inputmode="numeric"
value={displayValue(cat.id)}
onkeydown={(e) => handleKey(e, cat.id)}
onblur={() => saveOne(cat.id)}
class="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-right text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
placeholder="0,00"
/>
</div>
</div>
{/each}
</div>
{/if}
</div>
{/each}
</div>

<!-- Footer total -->
<div class="mt-5 rounded-xl border px-5 py-4 {sobra < 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}">
<div class="flex items-center justify-end gap-6 text-sm text-slate-600">
<span>Proventos: <span class="font-bold text-emerald-700">{formatBRL(incomeForecast)}</span></span>
<span>Total previsto: <span class="font-bold text-slate-900">{formatBRL(grandTotal)}</span></span>
<span>
{sobra < 0 ? 'Faltam' : 'Sobra'}:
<span class="font-bold {sobra < 0 ? 'text-red-600' : 'text-emerald-700'}">{formatBRL(Math.abs(sobra))}</span>
</span>
</div>
{#if sobra < 0}
<div class="mt-1 text-right text-xs font-semibold text-red-600">⚠ Previsto excede os proventos em {formatBRL(-sobra)} — reduza o orçamento.</div>
{/if}
</div>
</div>

<ConfirmModal
	open={showConfirm}
	title="Sobrescrever previsto?"
	message="O próximo mês já possui previsto preenchido. Deseja sobrescrever com os valores do mês atual?"
	confirmLabel="Sim, sobrescrever"
	cancelLabel="Cancelar"
	onConfirm={doCopy}
	onCancel={() => (showConfirm = false)}
/>

<ConfirmModal
	open={showClearConfirm}
	title="Limpar previsto?"
	message="Isso irá apagar todos os valores previstos deste mês. Esta ação não pode ser desfeita."
	confirmLabel="Sim, limpar tudo"
	cancelLabel="Cancelar"
	onConfirm={clearAll}
	onCancel={() => (showClearConfirm = false)}
/>
