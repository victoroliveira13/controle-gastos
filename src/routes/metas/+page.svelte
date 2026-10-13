<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatBRL, monthLabel, currentYearMonth } from '$lib/utils/format';
	import { display } from '$lib/display.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmt = $derived((v: number) => (display.hidden ? '••••••' : formatBRL(v)));

	type Goal = (typeof data.goals)[0];

	// Meses restantes contando o mês atual (prazo no mês atual = 1 mês)
	function monthsLeft(targetDate: string | null) {
		if (!targetDate) return null;
		const [cy, cm] = currentYearMonth().split('-').map(Number);
		const [ty, tm] = targetDate.split('-').map(Number);
		return ty * 12 + tm - (cy * 12 + cm) + 1;
	}

	const goalsView = $derived(
		data.goals.map((g) => {
			const remaining = Math.max(0, g.targetAmount - g.savedAmount);
			const left = monthsLeft(g.targetDate);
			const done = remaining === 0;
			return {
				...g,
				remaining,
				left,
				done,
				overdue: !done && left != null && left <= 0,
				pct: Math.min(100, (g.savedAmount / g.targetAmount) * 100),
				perMonth: done || left == null ? null : remaining / Math.max(1, left)
			};
		})
	);

	const totalSaved = $derived(data.goals.reduce((s, g) => s + g.savedAmount, 0));
	const totalTarget = $derived(data.goals.reduce((s, g) => s + g.targetAmount, 0));
	const totalPerMonth = $derived(goalsView.reduce((s, g) => s + (g.perMonth ?? 0), 0));

	// Modal de criar/editar
	let modalOpen = $state(false);
	let editing = $state<Goal | null>(null);
	let deleting = $state<Goal | null>(null);
	let error = $state('');

	function openCreate() {
		editing = null;
		error = '';
		modalOpen = true;
	}

	function openEdit(g: Goal) {
		editing = g;
		error = '';
		modalOpen = true;
	}

	const inputCls =
		'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none';
</script>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-slate-900">Metas</h1>
		<button
			onclick={openCreate}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			+ Nova meta
		</button>
	</div>

	<!-- Summary cards -->
	<div class="mb-7 grid grid-cols-3 gap-5">
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Total guardado</div>
			<div class="text-2xl font-bold text-emerald-600">{fmt(totalSaved)}</div>
		</div>
		<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Soma das metas</div>
			<div class="text-2xl font-bold text-slate-800">{fmt(totalTarget)}</div>
		</div>
		<div class="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
			<div class="mb-1 text-sm font-medium text-slate-500">Guardar por mês</div>
			<div class="text-2xl font-bold text-indigo-700">{fmt(totalPerMonth)}</div>
			<div class="mt-1 text-xs text-slate-400">para cumprir todos os prazos</div>
		</div>
	</div>

	<!-- Goals list -->
	{#if goalsView.length === 0}
		<div class="rounded-xl border border-slate-100 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
			Nenhuma meta cadastrada.
			<button onclick={openCreate} class="ml-1 text-indigo-600 hover:underline">Criar →</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each goalsView as g (g.id)}
				<div class="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
					<div class="mb-3 flex items-start justify-between gap-4">
						<div>
							<div class="flex items-center gap-2">
								<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">#{g.priority}</span>
								<span class="text-base font-semibold text-slate-900">{g.name}</span>
								{#if g.done}
									<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Concluída</span>
								{:else if g.overdue}
									<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Prazo vencido</span>
								{/if}
							</div>
							{#if g.notes}
								<div class="mt-1 text-xs text-slate-400">{g.notes}</div>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<button onclick={() => openEdit(g)} class="text-xs text-slate-400 hover:text-indigo-600">✏️</button>
							<button onclick={() => (deleting = g)} class="text-xs text-slate-400 hover:text-red-600">🗑️</button>
						</div>
					</div>

					<!-- Progress -->
					<div class="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
						<div
							class="h-full rounded-full {g.done ? 'bg-emerald-500' : 'bg-indigo-500'} transition-all"
							style="width: {g.pct}%"
						></div>
					</div>
					<div class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
						<span class="font-semibold text-slate-800">{fmt(g.savedAmount)} <span class="font-normal text-slate-400">de {fmt(g.targetAmount)}</span></span>
						<span class="text-slate-500">{g.pct.toFixed(0)}%</span>
						{#if g.targetDate}
							<span class="text-slate-500">Prazo: {monthLabel(g.targetDate)}
								{#if !g.done && g.left != null && g.left > 0}
									<span class="text-slate-400">({g.left} {g.left === 1 ? 'mês' : 'meses'})</span>
								{/if}
							</span>
						{/if}
						{#if g.perMonth != null}
							<span class="ml-auto font-medium text-indigo-700">Guardar {fmt(g.perMonth)}/mês</span>
						{/if}
					</div>

					<!-- Aporte / retirada -->
					<form
						method="POST"
						action="?/contribute"
						class="flex items-center gap-2"
						use:enhance={() => {
							return async ({ update, formElement }) => {
								await update({ reset: false });
								formElement.reset();
							};
						}}
					>
						<input type="hidden" name="id" value={g.id} />
						<input
							name="amount"
							type="text"
							inputmode="decimal"
							placeholder="Valor (ex: 300)"
							required
							class="w-40 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
						/>
						<button
							type="submit"
							name="direction"
							value="in"
							class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
						>+ Guardar</button>
						<button
							type="submit"
							name="direction"
							value="out"
							class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
						>− Retirar</button>
					</form>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create / edit modal -->
{#if modalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-96 rounded-xl bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-base font-semibold text-slate-900">{editing ? 'Editar meta' : 'Nova meta'}</h3>
			<form
				method="POST"
				action={editing ? '?/update' : '?/create'}
				class="space-y-3"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'failure') {
							error = (result.data?.error as string) ?? 'Erro ao salvar';
							return;
						}
						modalOpen = false;
						await update();
					};
				}}
			>
				{#if editing}
					<input type="hidden" name="id" value={editing.id} />
				{/if}
				<label class="block text-sm">
					<span class="mb-1 block text-slate-600">Nome</span>
					<input name="name" required value={editing?.name ?? ''} class={inputCls} />
				</label>
				<div class="grid grid-cols-2 gap-3">
					<label class="block text-sm">
						<span class="mb-1 block text-slate-600">Valor da meta (R$)</span>
						<input
							name="targetAmount"
							required
							inputmode="decimal"
							value={editing ? String(editing.targetAmount).replace('.', ',') : ''}
							class={inputCls}
						/>
					</label>
					<label class="block text-sm">
						<span class="mb-1 block text-slate-600">Prazo</span>
						<input name="targetDate" type="month" value={editing?.targetDate ?? ''} class={inputCls} />
					</label>
				</div>
				<label class="block text-sm">
					<span class="mb-1 block text-slate-600">Prioridade (1 = mais urgente)</span>
					<input name="priority" type="number" min="1" value={editing?.priority ?? data.goals.length + 1} class={inputCls} />
				</label>
				<label class="block text-sm">
					<span class="mb-1 block text-slate-600">Observações</span>
					<textarea name="notes" rows="2" class={inputCls}>{editing?.notes ?? ''}</textarea>
				</label>
				{#if error}
					<p class="text-sm text-red-600">{error}</p>
				{/if}
				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => (modalOpen = false)}
						class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
					>Cancelar</button>
					<button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
						Salvar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete confirm dialog -->
{#if deleting}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-80 rounded-xl bg-white p-6 shadow-xl">
			<h3 class="mb-2 text-base font-semibold text-slate-900">Excluir meta?</h3>
			<p class="mb-5 text-sm text-slate-500">"{deleting.name}" será removida. Esta ação não pode ser desfeita.</p>
			<div class="flex justify-end gap-3">
				<button onclick={() => (deleting = null)} class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
				<form method="POST" action="?/delete" use:enhance={() => {
					return async ({ update }) => {
						deleting = null;
						await update();
					};
				}}>
					<input type="hidden" name="id" value={deleting.id} />
					<button type="submit" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
				</form>
			</div>
		</div>
	</div>
{/if}
