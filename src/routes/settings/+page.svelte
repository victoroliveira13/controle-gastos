<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let saved = $state(false);
	let salarySaved = $state(false);
	let rawCents = $state(Math.round(data.initialBalance * 100));

	const displayAmount = $derived(
		(rawCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	);

	function handleAmountKey(e: KeyboardEvent) {
		if (e.key >= '0' && e.key <= '9') {
			e.preventDefault();
			rawCents = rawCents * 10 + parseInt(e.key);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			rawCents = Math.floor(rawCents / 10);
		}
	}
</script>

<div class="px-8 pt-6 pb-8">
	<div class="mb-8">
		<h1 class="mb-1 text-2xl font-bold text-slate-900">Configurações</h1>
		<p class="text-sm text-slate-400">Ajustes gerais do sistema.</p>
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

		<!-- Salário previsto -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-1 text-base font-semibold text-slate-800">🗓 Salário</h2>
			<p class="mb-4 text-sm text-slate-500">
				Usado na projeção do dashboard. O valor do salário vem da receita prevista do mês, em Previsto.
			</p>
			<form
				method="POST"
				action="?/saveSalary"
				use:enhance={() =>
					async ({ update }) => {
						await update({ reset: false });
						salarySaved = true;
						setTimeout(() => (salarySaved = false), 3000);
					}}
				class="flex items-end gap-3"
			>
				<label class="text-sm text-slate-600">
					Dia útil do pagamento
					<input name="salaryBusinessDay" type="number" min="1" max="23" step="1" value={data.salary.businessDay}
						class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none" />
				</label>
				<div class="flex items-center gap-3">
					{#if salarySaved}
						<span class="text-sm text-emerald-600">✅ Salvo!</span>
					{/if}
					<button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
						Salvar
					</button>
				</div>
			</form>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-1 text-base font-semibold text-slate-800">💰 Saldo inicial</h2>
			<p class="mb-4 text-sm text-slate-500">
				Valor em conta antes do primeiro lançamento registrado no sistema. Será somado ao saldo acumulado em todos os meses.
			</p>

			<form
				method="POST"
				action="?/saveInitialBalance"
				use:enhance={() =>
					async ({ update }) => {
						await update();
						saved = true;
						setTimeout(() => (saved = false), 3000);
					}}
				class="flex items-center gap-3"
			>
				<div class="relative flex-1">
					<span class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">R$</span>
					<input type="hidden" name="initialBalance" value={rawCents / 100} />
					<input
						readonly
						inputmode="numeric"
						value={displayAmount}
						onkeydown={handleAmountKey}
						placeholder="0,00"
						class="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-10 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>
				<button
					type="submit"
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Salvar
				</button>
				{#if saved}
					<span class="text-sm text-emerald-600">✅ Salvo!</span>
				{/if}
			</form>
		</div>
	</div>
</div>

