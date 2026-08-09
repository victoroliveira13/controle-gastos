<script lang="ts">
	import { enhance } from '$app/forms';
	import { todayISO } from '$lib/utils/format';

	export interface CategoryOption {
		id: number;
		code: string;
		name: string;
		groupCode: string;
		groupName: string;
		isIncome: boolean;
	}

	export interface TransactionRow {
		id: number;
		amount: number;
		type: 'income' | 'expense';
		date: string;
		description: string | null;
		categoryId: number;
	}

	interface Props {
		open: boolean;
		categories: CategoryOption[];
		transaction?: TransactionRow | null;
		onClose: () => void;
	}

	let { open, categories, transaction = null, onClose }: Props = $props();

	let dialog: HTMLDialogElement;
	let formType = $state<'income' | 'expense'>('expense');
	let rawCents = $state(0);

	$effect(() => {
		formType = transaction?.type ?? 'expense';
		rawCents = Math.round((transaction?.amount ?? 0) * 100);
		if (open) dialog?.showModal();
		else dialog?.close();
	});

	function handleAmountKey(e: KeyboardEvent) {
		if (e.key >= '0' && e.key <= '9') {
			e.preventDefault();
			rawCents = rawCents * 10 + parseInt(e.key);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			rawCents = Math.floor(rawCents / 10);
		}
	}

	const displayAmount = $derived(
		(rawCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	);

	const filteredCategories = $derived(categories.filter((c) => c.isIncome === (formType === 'income')));

	const isEdit = $derived(transaction != null);
	const title = $derived(isEdit ? 'Editar Lançamento' : 'Novo Lançamento');
	const action = $derived(isEdit ? '?/update' : '?/create');
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="w-full max-w-md rounded-xl bg-white p-0 shadow-2xl backdrop:bg-black/40"
	onclose={onClose}
>
	<form
		method="POST"
		{action}
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success' || result.type === 'redirect') {
					dialog.close();
					onClose();
				}
				await update();
			};
		}}
	>
		{#if isEdit}
			<input type="hidden" name="id" value={transaction?.id} />
		{/if}

		<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
			<h2 class="text-lg font-semibold text-gray-900">{title}</h2>
			<button type="button" onclick={() => dialog.close()} class="text-gray-400 hover:text-gray-600">
				✕
			</button>
		</div>

		<div class="space-y-4 px-6 py-5">
			<!-- Tipo -->
			<div>
				<label class="mb-1.5 block text-sm font-medium text-gray-700">Tipo</label>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => (formType = 'expense')}
						class="flex-1 rounded-lg border py-2 text-sm font-medium transition-colors
                   {formType === 'expense'
							? 'border-red-500 bg-red-50 text-red-700'
							: 'border-gray-200 text-gray-500 hover:border-gray-300'}"
					>
						💸 Despesa
					</button>
					<button
						type="button"
						onclick={() => (formType = 'income')}
						class="flex-1 rounded-lg border py-2 text-sm font-medium transition-colors
                   {formType === 'income'
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-gray-200 text-gray-500 hover:border-gray-300'}"
					>
						💰 Receita
					</button>
				</div>
				<input type="hidden" name="type" value={formType} />
			</div>

			<!-- Data -->
			<div>
				<label for="date" class="mb-1.5 block text-sm font-medium text-gray-700">Data</label>
				<input
					id="date"
					name="date"
					type="date"
					value={transaction?.date ?? todayISO()}
					required
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>

			<!-- Valor -->
			<div>
				<label for="amount" class="mb-1.5 block text-sm font-medium text-gray-700">Valor (R$)</label>
				<input type="hidden" name="amount" value={rawCents / 100} />
				<input
					id="amount"
					readonly
					inputmode="numeric"
					value={displayAmount}
					onkeydown={handleAmountKey}
					placeholder="0,00"
					required
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>

			<!-- Categoria -->
			<div>
				<label for="categoryId" class="mb-1.5 block text-sm font-medium text-gray-700">Categoria</label>
				<select
					id="categoryId"
					name="categoryId"
					required
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				>
					<option value="">Selecione...</option>
					{#each filteredCategories as cat}
						<option value={cat.id} selected={cat.id === transaction?.categoryId}>
							{cat.code} — {cat.name}
						</option>
					{/each}
				</select>
			</div>

			<!-- Descrição -->
			<div>
				<label for="description" class="mb-1.5 block text-sm font-medium text-gray-700"
					>Descrição <span class="text-gray-400">(opcional)</span></label
				>
				<input
					id="description"
					name="description"
					type="text"
					value={transaction?.description ?? ''}
					placeholder="Ex: Conta do mês"
					class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
			<button
				type="button"
				onclick={() => dialog.close()}
				class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
			>
				Cancelar
			</button>
			<button
				type="submit"
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>
				{isEdit ? 'Salvar alterações' : 'Adicionar'}
			</button>
		</div>
	</form>
</dialog>
