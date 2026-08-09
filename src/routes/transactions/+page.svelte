<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import TransactionModal from '$lib/components/TransactionModal.svelte';
	import { formatBRL, monthLabel, prevMonth, nextMonth, GROUP_COLORS } from '$lib/utils/format';
	import type { PageData } from './$types';
	import type { TransactionRow, CategoryOption } from '$lib/components/TransactionModal.svelte';

	let { data }: { data: PageData } = $props();

	let filterForm = $state<HTMLFormElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;

	async function submitFilter() {
		await tick();
		filterForm?.requestSubmit();
	}

	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(submitFilter, 400);
	}

	// Multi-select category dropdown
	let catDropdownOpen = $state(false);
	let selectedCategoryIds = $state<number[]>([...data.filters.categoryIds]);

	$effect(() => {
		selectedCategoryIds = [...data.filters.categoryIds];
	});

	function toggleCategory(id: number) {
		selectedCategoryIds = selectedCategoryIds.includes(id)
			? selectedCategoryIds.filter((x) => x !== id)
			: [...selectedCategoryIds, id];
	}

	function clearCategories() {
		selectedCategoryIds = [];
		submitFilter();
	}

	// Group categories by groupCode
	const categoryGroups = $derived.by(() => {
		const map = new Map<string, { groupCode: string; groupName: string; cats: typeof data.allCategories }>();
		for (const cat of data.allCategories) {
			if (!map.has(cat.groupCode)) map.set(cat.groupCode, { groupCode: cat.groupCode, groupName: cat.groupName, cats: [] });
			map.get(cat.groupCode)!.cats.push(cat);
		}
		return [...map.values()];
	});

	const catButtonLabel = $derived(
		selectedCategoryIds.length === 0
			? 'Todas as categorias'
			: selectedCategoryIds.length === 1
				? data.allCategories.find((c) => c.id === selectedCategoryIds[0])?.code ?? '1 selecionada'
				: `${selectedCategoryIds.length} categorias`
	);

	function toggleGroup(groupCats: typeof data.allCategories) {
		const ids = groupCats.map((c) => c.id);
		const allSelected = ids.every((id) => selectedCategoryIds.includes(id));
		if (allSelected) {
			selectedCategoryIds = selectedCategoryIds.filter((id) => !ids.includes(id));
		} else {
			selectedCategoryIds = [...new Set([...selectedCategoryIds, ...ids])];
		}
	}

	let modalOpen = $state(false);
	let editing = $state<TransactionRow | null>(null);
	let deletingId = $state<number | null>(null);

	function openCreate() {
		editing = null;
		modalOpen = true;
	}

	function openEdit(tx: (typeof data.rows)[0]) {
		editing = {
			id: tx.id,
			amount: tx.amount,
			type: tx.type as 'income' | 'expense',
			date: tx.date,
			description: tx.description,
			categoryId: tx.categoryId
		};
		modalOpen = true;
	}

	import { display } from '$lib/display.svelte';

	const fmt = $derived((v: number) => display.hidden ? '••••••' : formatBRL(v));

	function navigate(dir: 'prev' | 'next') {
		const m = dir === 'prev' ? prevMonth(data.ym) : nextMonth(data.ym);
		goto(`/transactions?month=${m}`);
	}

	const balance = $derived(data.income - data.expense);
	const finalBalance = $derived(data.previousBalance + balance);

	const rowsWithBalance = $derived.by(() => {
		// Saldo acumula a partir do saldo anterior (meses anteriores)
		let running = data.previousBalance;
		return data.rows.map((tx) => {
			running += tx.type === 'income' ? tx.amount : -tx.amount;
			return { ...tx, runningBalance: running };
		});
	});
</script>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-slate-900">Lançamentos</h1>
		<button
			onclick={openCreate}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			+ Novo lançamento
		</button>
	</div>

	<!-- Month nav + summary -->
	<div class="mb-6 flex items-center gap-4">
		<div class="flex items-center gap-2">
			<button onclick={() => navigate('prev')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">←</button>
			<span class="w-28 text-center text-sm font-medium text-slate-700">{monthLabel(data.ym)}</span>
			<button onclick={() => navigate('next')} class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">→</button>
		</div>
		<div class="ml-auto flex items-center gap-4 text-sm">
			<span class="font-medium text-emerald-600">↑ {fmt(data.income)}</span>
			<span class="font-medium text-red-600">↓ {fmt(data.expense)}</span>
			<span class="font-semibold {balance >= 0 ? 'text-emerald-700' : 'text-red-700'}">= {fmt(balance)}</span>
		</div>
	</div>

	<!-- Filters -->
	<form
		bind:this={filterForm}
		method="GET"
		class="mb-5 flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
	>
		<input type="hidden" name="month" value={data.ym} />
		{#each selectedCategoryIds as id}
			<input type="hidden" name="categoryId" value={id} />
		{/each}

		<input
			name="q"
			type="text"
			placeholder="Buscar descrição..."
			value={data.filters.search}
			oninput={onSearchInput}
			class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
		/>

		<!-- Category multi-select dropdown -->
		<div
			class="relative"
			onfocusout={(e) => {
				if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
					catDropdownOpen = false;
					submitFilter();
				}
			}}
		>
			<button
				type="button"
				onclick={() => (catDropdownOpen = !catDropdownOpen)}
				class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
					{selectedCategoryIds.length > 0
						? 'border-indigo-400 bg-indigo-50 text-indigo-700'
						: 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
			>
				{catButtonLabel}
				<span class="text-xs opacity-60">{catDropdownOpen ? '▲' : '▼'}</span>
			</button>

			{#if catDropdownOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute top-full right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg"
					onmouseleave={() => (catDropdownOpen = false)}
				>
					{#if selectedCategoryIds.length > 0}
						<div class="border-b border-slate-100 px-3 py-2">
							<button type="button" onclick={clearCategories} class="text-xs text-indigo-600 hover:underline">
								Limpar seleção ({selectedCategoryIds.length})
							</button>
						</div>
					{/if}
					<div class="max-h-72 overflow-y-auto py-1">
						{#each categoryGroups as group}
							{@const groupIds = group.cats.map((c) => c.id)}
							{@const allChecked = groupIds.every((id) => selectedCategoryIds.includes(id))}
							{@const someChecked = groupIds.some((id) => selectedCategoryIds.includes(id))}
							<label class="flex cursor-pointer items-center justify-between px-3 pt-2 pb-1 hover:bg-slate-50/60">
								<span class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
									{group.groupCode} — {group.groupName}
								</span>
								<input
									type="checkbox"
									checked={allChecked}
									indeterminate={someChecked && !allChecked}
									onchange={() => toggleGroup(group.cats)}
									class="accent-indigo-600"
								/>
							</label>
							{#each group.cats as cat}
								<label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
									<input
										type="checkbox"
										checked={selectedCategoryIds.includes(cat.id)}
										onchange={() => toggleCategory(cat.id)}
										class="accent-indigo-600"
									/>
									<span class="font-mono text-xs text-slate-500">{cat.code}</span>
									<span class="text-slate-700">{cat.name}</span>
								</label>
							{/each}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<a
			href="/transactions?month={data.ym}"
			onclick={() => (selectedCategoryIds = [])}
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50"
		>Limpar</a>
	</form>

	<!-- Table -->
	<div class="rounded-xl border border-slate-100 bg-white shadow-sm">
		{#if data.rows.length === 0}
			<div class="py-16 text-center text-sm text-slate-400">
				Nenhum lançamento encontrado.
				<button onclick={openCreate} class="ml-1 text-indigo-600 hover:underline">Adicionar →</button>
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
					<tr>
						<th class="px-3 py-3 text-center">#</th>
						<th class="px-5 py-3 text-left">Data</th>
						<th class="px-5 py-3 text-left">Descrição</th>
						<th class="px-5 py-3 text-left">Categoria</th>
						<th class="px-5 py-3 text-right">Valor</th>
						<th class="px-5 py-3 text-right">Saldo</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					<!-- Linha de saldo anterior -->
					{#if data.previousBalance !== 0}
						<tr class="bg-slate-50/80">
							<td class="px-3 py-2.5"></td>
							<td class="px-5 py-2.5 text-xs text-slate-400">—</td>
							<td class="px-5 py-2.5 text-xs font-medium text-slate-500 italic" colspan="3">
								↩ Saldo anterior
							</td>
							<td class="px-5 py-2.5 text-right text-sm font-semibold {data.previousBalance >= 0 ? 'text-slate-600' : 'text-red-600'}">
								{fmt(data.previousBalance)}
							</td>
							<td class="px-5 py-2.5"></td>
						</tr>
					{/if}
					{#each rowsWithBalance as tx, i}
						<tr class="hover:bg-slate-50/50">
							<td class="px-3 py-3 text-center text-xs font-medium text-slate-400">{i + 1}</td>
							<td class="px-5 py-3 text-slate-500">{tx.date.split('-').reverse().join('/')}</td>
							<td class="px-5 py-3 text-slate-800">{tx.description ?? '—'}</td>
							<td class="px-5 py-3">
								<span
									class="rounded-full px-2 py-0.5 text-xs font-medium"
									style="background:{GROUP_COLORS[tx.groupCode]}22; color:{GROUP_COLORS[tx.groupCode]}"
								>
									{tx.categoryCode} {tx.categoryName}
								</span>
							</td>
							<td class="px-5 py-3 text-right font-semibold {tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}">
								{tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
							</td>
							<td class="px-5 py-3 text-right text-sm font-semibold {tx.runningBalance >= 0 ? 'text-slate-700' : 'text-red-600'}">
								{fmt(tx.runningBalance)}
							</td>
							<td class="px-5 py-3 text-right">
								<button onclick={() => openEdit(tx)} class="mr-2 text-xs text-slate-400 hover:text-indigo-600">✏️</button>
								<button
									onclick={() => (deletingId = tx.id)}
									class="text-xs text-slate-400 hover:text-red-600"
								>🗑️</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<!-- Delete confirm dialog -->
{#if deletingId != null}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-80 rounded-xl bg-white p-6 shadow-xl">
			<h3 class="mb-2 text-base font-semibold text-slate-900">Excluir lançamento?</h3>
			<p class="mb-5 text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
			<div class="flex justify-end gap-3">
				<button onclick={() => (deletingId = null)} class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
				<form method="POST" action="?/delete" use:enhance={() => {
					return async ({ update }) => {
						deletingId = null;
						await update();
					};
				}}>
					<input type="hidden" name="id" value={deletingId} />
					<button type="submit" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Excluir</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<TransactionModal
	open={modalOpen}
	categories={data.allCategories as CategoryOption[]}
	transaction={editing}
	onClose={() => (modalOpen = false)}
/>
