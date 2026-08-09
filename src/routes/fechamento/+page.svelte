<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatBRL, monthLabel, prevMonth, nextMonth } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let imprevisto = $state('');
	let superfluous = $state('');
	let coverage = $state('');
	let observations = $state('');
	let saved = $state(false);
	let saving = $state(false);

	$effect(() => {
		void data.ym;
		imprevisto = data.notes.imprevisto ?? '';
		superfluous = data.notes.superfluous ?? '';
		coverage = data.notes.coverage ?? '';
		observations = data.notes.observations ?? '';
		saved = false;
	});

	function navigate(dir: 'prev' | 'next') {
		const m = dir === 'prev' ? prevMonth(data.ym) : nextMonth(data.ym);
		goto(`/fechamento?month=${m}`);
	}

	const balanceColor = $derived(data.balance >= 0 ? 'text-emerald-600' : 'text-red-600');
</script>

<div class="p-8 max-w-3xl mx-auto">
	<!-- Header -->
	<div class="mb-7 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">Fechamento do Mês</h1>
			<p class="mt-1 text-sm text-slate-500">Plano de ação e justificativa para {monthLabel(data.ym)}</p>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={() => navigate('prev')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">←</button>
			<span class="w-28 text-center text-sm font-medium text-slate-700">{monthLabel(data.ym)}</span>
			<button onclick={() => navigate('next')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">→</button>
		</div>
	</div>

	<!-- Resumo financeiro -->
	<div class="mb-6 grid grid-cols-3 gap-4">
		<div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm text-center">
			<div class="text-xs font-medium text-slate-500 mb-1">Receitas</div>
			<div class="text-lg font-bold text-emerald-600">{formatBRL(data.income)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm text-center">
			<div class="text-xs font-medium text-slate-500 mb-1">Despesas</div>
			<div class="text-lg font-bold text-red-600">{formatBRL(data.expense)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm text-center">
			<div class="text-xs font-medium text-slate-500 mb-1">Saldo</div>
			<div class="text-lg font-bold {balanceColor}">{formatBRL(data.balance)}</div>
		</div>
	</div>

	<!-- Grupos estourados -->
	{#if data.overGroups.length > 0}
	<div class="mb-6 rounded-xl border border-red-100 bg-red-50 px-5 py-4">
		<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">Grupos acima do previsto</div>
		<div class="space-y-1">
			{#each data.overGroups as g}
				<div class="flex items-center justify-between text-sm">
					<span class="text-slate-700">{g.groupName}</span>
					<span class="font-semibold text-red-600">+{formatBRL(g.realizado - g.previsto)}</span>
				</div>
			{/each}
		</div>
	</div>
	{/if}

	<!-- Formulário -->
	<form
		method="POST"
		action="?/save&month={data.ym}"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
				saved = true;
				setTimeout(() => (saved = false), 2500);
			};
		}}
		class="space-y-5"
	>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<label class="mb-1.5 block text-sm font-semibold text-slate-700">
				⚡ Qual foi o imprevisto do mês?
			</label>
			<p class="mb-2 text-xs text-slate-400">Gastos não planejados que surgiram durante o mês.</p>
			<textarea
				name="imprevisto"
				bind:value={imprevisto}
				rows="3"
				placeholder="Ex: Consulta médica urgente, reparo no carro..."
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
			></textarea>
		</div>

		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<label class="mb-1.5 block text-sm font-semibold text-slate-700">
				🛍️ Quais gastos foram supérfluos?
			</label>
			<p class="mb-2 text-xs text-slate-400">Gastos que poderiam ter sido evitados ou reduzidos.</p>
			<textarea
				name="superfluous"
				bind:value={superfluous}
				rows="3"
				placeholder="Ex: Delivery em excesso, compras por impulso..."
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
			></textarea>
		</div>

		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<label class="mb-1.5 block text-sm font-semibold text-slate-700">
				🔄 Como irei cobrir o saldo negativo no próximo mês?
			</label>
			<p class="mb-2 text-xs text-slate-400">Plano de ação para compensar déficits ou manter equilíbrio.</p>
			<textarea
				name="coverage"
				bind:value={coverage}
				rows="3"
				placeholder="Ex: Reduzir lazer, usar reserva de emergência..."
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
			></textarea>
		</div>

		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<label class="mb-1.5 block text-sm font-semibold text-slate-700">
				📝 Demais observações
			</label>
			<p class="mb-2 text-xs text-slate-400">Qualquer outra anotação relevante sobre o mês.</p>
			<textarea
				name="observations"
				bind:value={observations}
				rows="3"
				placeholder="Anotações livres sobre o mês..."
				class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
			></textarea>
		</div>

		<div class="flex items-center justify-between pt-1">
			<a href="/dashboard?month={data.ym}" class="text-sm text-slate-500 hover:text-slate-700">← Voltar ao dashboard</a>
			<button
				type="submit"
				disabled={saving}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
			>
				{#if saving}
					<span>Salvando...</span>
				{:else if saved}
					<span>✓ Salvo!</span>
				{:else}
					<span>Salvar fechamento</span>
				{/if}
			</button>
		</div>
	</form>
</div>
