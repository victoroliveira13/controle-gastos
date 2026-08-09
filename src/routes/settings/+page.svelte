<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let saved = $state(false);
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

	let pluggyClientId = $state(data.pluggy.clientId);
	let pluggyClientSecret = $state(data.pluggy.clientSecret);
	let pluggySaved = $state(false);
	let pluggyConfigSaved = $state(false);
	let showSecret = $state(false);
	let syncing = $state(false);
	let syncMsg = $state('');

	function fmtDate(iso: string) {
		if (!iso) return '—';
		const [y, m, d] = iso.substring(0, 10).split('-');
		return `${d}/${m}/${y}`;
	}

	function fmtDateTime(iso: string) {
		if (!iso) return '—';
		const dt = new Date(iso);
		return dt.toLocaleString('pt-BR');
	}
</script>

<div class="px-8 py-8">
	<div class="mb-8">
		<h1 class="mb-1 text-2xl font-bold text-slate-900">Configurações</h1>
		<p class="text-sm text-slate-400">Ajustes gerais do sistema.</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

		<!-- Saldo inicial -->
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

		<!-- Pluggy / Open Finance — Credenciais -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-1 text-base font-semibold text-slate-800">🏦 Open Finance — Pluggy</h2>
			<p class="mb-1 text-sm text-slate-500">
				Credenciais para importar transações diretamente dos bancos via Open Finance.
			</p>
			<p class="mb-4 text-xs text-slate-400">
				Crie sua conta e obtenha as credenciais em
				<a href="https://dashboard.pluggy.ai" target="_blank" class="text-indigo-500 hover:underline">dashboard.pluggy.ai</a>.
			</p>

			<form
				method="POST"
				action="?/savePluggy"
				use:enhance={() =>
					async ({ update }) => {
						await update();
						pluggySaved = true;
						setTimeout(() => (pluggySaved = false), 3000);
					}}
				class="space-y-4"
			>
				<div>
					<label for="pluggy-client-id" class="mb-1.5 block text-xs font-medium text-slate-600">Client ID</label>
					<input
						id="pluggy-client-id"
						name="pluggy_client_id"
						type="text"
						bind:value={pluggyClientId}
						placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
						autocomplete="off"
						class="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="pluggy-client-secret" class="mb-1.5 block text-xs font-medium text-slate-600">Client Secret</label>
					<div class="relative">
						<input
							id="pluggy-client-secret"
							name="pluggy_client_secret"
							type={showSecret ? 'text' : 'password'}
							bind:value={pluggyClientSecret}
							placeholder="••••••••••••••••••••••••"
							autocomplete="off"
							class="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showSecret = !showSecret)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
							title={showSecret ? 'Ocultar' : 'Mostrar'}
						>
							{showSecret ? '🙈' : '👁️'}
						</button>
					</div>
				</div>

				<div class="flex items-center gap-3 pt-1">
					<button
						type="submit"
						class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
					>
						Salvar
					</button>
					{#if pluggySaved || form?.pluggySaved}
						<span class="text-sm text-emerald-600">✅ Salvo!</span>
					{/if}
					{#if pluggyClientId && pluggyClientSecret}
						<span class="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
							✓ Configurado
						</span>
					{:else}
						<span class="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
							Não configurado
						</span>
					{/if}
				</div>
			</form>
		</div>

		<!-- Pluggy — Sync automático (largura total) -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
			<h2 class="mb-4 text-base font-semibold text-slate-800">🔄 Sincronização automática</h2>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- Coluna esquerda: status + bancos -->
				<div>
					<!-- Status último sync -->
					<div class="mb-5 rounded-lg bg-slate-50 p-3 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-slate-500">Última sincronização</span>
							<span class="font-medium text-slate-700">{fmtDate(data.pluggy.lastSync)}</span>
						</div>
						{#if data.pluggy.syncStatus}
							<div class="mt-1.5 flex items-center justify-between text-xs text-slate-400">
								<span>Executado em {fmtDateTime(data.pluggy.syncStatus.at)}</span>
								<span>
									{data.pluggy.syncStatus.inserted} inseridas &middot; {data.pluggy.syncStatus.skipped} ignoradas
									{#if data.pluggy.syncStatus.errors.length > 0}
										&middot; <span class="text-red-500">{data.pluggy.syncStatus.errors.length} erro(s)</span>
									{/if}
								</span>
							</div>
							{#if data.pluggy.syncStatus.errors.length > 0}
								<ul class="mt-1.5 space-y-0.5">
									{#each data.pluggy.syncStatus.errors as err}
										<li class="text-xs text-red-500">{err}</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</div>

					<!-- Bancos conectados -->
					<div class="mb-4">
						<p class="mb-2 text-xs font-medium text-slate-600">Bancos conectados</p>
						{#if data.pluggy.items.length === 0}
							<p class="text-xs text-slate-400">
								Nenhum banco conectado ainda. Vá em
								<a href="/import" class="text-indigo-500 hover:underline">Importar → Open Finance</a>
								para conectar.
							</p>
						{:else}
							<ul class="space-y-2">
								{#each data.pluggy.items as item}
									<li class="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
										<span class="text-sm font-medium text-slate-700">🏦 {item.name}</span>
										<form method="POST" action="?/removeItem" use:enhance>
											<input type="hidden" name="item_id" value={item.id} />
											<button
												type="submit"
												class="text-xs text-red-400 hover:text-red-600"
												title="Remover banco"
												onclick={(e) => { if (!confirm(`Remover ${item.name}?`)) e.preventDefault(); }}
											>
												Remover
											</button>
										</form>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Sync manual -->
					<div class="border-t border-slate-100 pt-4">
						<form
							method="POST"
							action="?/syncNow"
							use:enhance={() => {
								syncing = true;
								syncMsg = '';
								return async ({ result, update }) => {
									await update({ reset: false });
									syncing = false;
									if (result.type === 'success' && result.data?.syncResult) {
										const r = result.data.syncResult as { inserted: number; skipped: number; errors: string[] };
										syncMsg = r.errors.length > 0
											? `⚠️ ${r.inserted} inseridas, ${r.errors.length} erro(s)`
											: `✅ ${r.inserted} inseridas, ${r.skipped} ignoradas`;
									}
								};
							}}
						>
							<button
								type="submit"
								disabled={syncing}
								class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
							>
								{syncing ? '⏳ Sincronizando...' : '⚡ Sincronizar agora'}
							</button>
							{#if syncMsg}
								<span class="ml-3 text-sm text-slate-600">{syncMsg}</span>
							{/if}
						</form>
					</div>
				</div>

				<!-- Coluna direita: configurações de sync -->
				<div>
					<form
						method="POST"
						action="?/savePluggyConfig"
						use:enhance={() =>
							async ({ update }) => {
								await update();
								pluggyConfigSaved = true;
								setTimeout(() => (pluggyConfigSaved = false), 3000);
							}}
						class="space-y-4"
					>
						<div>
							<label for="sync-interval" class="mb-1.5 block text-xs font-medium text-slate-600">
								Intervalo de sync (horas)
							</label>
							<input
								id="sync-interval"
								name="sync_interval_hours"
								type="number"
								min="1"
								max="24"
								value={data.pluggy.syncIntervalHours}
								class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
							/>
						</div>

						<div>
							<label for="default-expense-cat" class="mb-1.5 block text-xs font-medium text-slate-600">
								Categoria padrão — Débito
							</label>
							<select
								id="default-expense-cat"
								name="default_expense_category"
								class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
							>
								<option value="">Primeira disponível</option>
								{#each data.expenseCategories as cat}
									<option value={cat.id} selected={String(cat.id) === data.pluggy.defaultExpenseCategoryId}>
										{cat.name}
									</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="default-income-cat" class="mb-1.5 block text-xs font-medium text-slate-600">
								Categoria padrão — Crédito
							</label>
							<select
								id="default-income-cat"
								name="default_income_category"
								class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
							>
								<option value="">Primeira disponível</option>
								{#each data.incomeCategories as cat}
									<option value={cat.id} selected={String(cat.id) === data.pluggy.defaultIncomeCategoryId}>
										{cat.name}
									</option>
								{/each}
							</select>
						</div>

						<div class="flex items-center gap-3 pt-1">
							<button
								type="submit"
								class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
							>
								Salvar configurações
							</button>
							{#if pluggyConfigSaved || form?.pluggyConfigSaved}
								<span class="text-sm text-emerald-600">✅ Salvo!</span>
							{/if}
						</div>
					</form>
				</div>
			</div>
		</div>

	</div>
</div>

