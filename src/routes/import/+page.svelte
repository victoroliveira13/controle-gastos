<script lang="ts">
	import type { PageData } from './$types';
	import { parseDate, parseBRLAmount } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	// ── Tab ──────────────────────────────────────────────────────────────────
	let activeTab = $state<'csv' | 'openfinance'>('csv');

	// ── CSV / XLSX ────────────────────────────────────────────────────────────
	type PreviewRow = {
		date: string | null;
		amount: number;
		categoryCode: string;
		description: string;
		valid: boolean;
	};

	let file = $state<File | null>(null);
	let preview = $state<PreviewRow[]>([]);
	let headers = $state<string[]>([]);
	let rawRows = $state<string[][]>([]);
	let colMap = $state({ date: '', amount: '', category: '', description: '' });
	let importing = $state(false);
	let result = $state<{ imported: number; skipped: number } | null>(null);
	let error = $state('');
	let dragging = $state(false);

	async function handleFileSelect(f: File) {
		file = f;
		result = null;
		error = '';
		preview = [];
		rawRows = [];
		headers = [];

		const ext = f.name.split('.').pop()?.toLowerCase();

		if (ext === 'csv') {
			const { default: Papa } = await import('papaparse');
			const text = await f.text();
			const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
			processRawData(parsed.data as string[][]);
		} else if (ext === 'xlsx' || ext === 'xls') {
			const XLSX = await import('xlsx');
			const buf = await f.arrayBuffer();
			const wb = XLSX.read(buf);
			const ws = wb.Sheets[wb.SheetNames[0]];
			const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
			processRawData(data);
		} else {
			error = 'Formato não suportado. Use CSV ou XLSX.';
		}
	}

	function processRawData(data: string[][]) {
		if (data.length < 2) { error = 'Arquivo vazio ou inválido.'; return; }
		headers = data[0].map((h) => String(h ?? '').trim());
		rawRows = data.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''));

		const guess = (targets: string[]) =>
			headers.findIndex((h) => targets.some((t) => h.toLowerCase().includes(t))) > -1
				? headers[headers.findIndex((h) => targets.some((t) => h.toLowerCase().includes(t)))]
				: '';

		colMap = {
			date: guess(['data', 'date', 'dt']),
			amount: guess(['valor', 'amount', 'value', 'vl']),
			category: guess(['categoria', 'category', 'código', 'codigo', 'cat', 'cod']),
			description: guess(['descrição', 'descricao', 'description', 'desc', 'obs'])
		};

		buildPreview();
	}

	function buildPreview() {
		const di = headers.indexOf(colMap.date);
		const ai = headers.indexOf(colMap.amount);
		const ci = headers.indexOf(colMap.category);
		const dsi = headers.indexOf(colMap.description);

		preview = rawRows.slice(0, 20).map((row) => {
			const dateRaw = di >= 0 ? (row[di] ?? '') : '';
			const amountRaw = ai >= 0 ? String(row[ai] ?? '') : '';
			const catRaw = ci >= 0 ? String(row[ci] ?? '').trim().toUpperCase() : '';
			const descRaw = dsi >= 0 ? String(row[dsi] ?? '') : '';

			const date = parseDate(dateRaw as string | number);
			const amount = parseBRLAmount(amountRaw);

			return {
				date,
				amount: isNaN(amount) ? 0 : Math.abs(amount),
				categoryCode: catRaw,
				description: descRaw,
				valid: !!date && !isNaN(amount) && amount !== 0 && catRaw.length > 0
			};
		});
	}

	$effect(() => {
		colMap;
		if (rawRows.length) buildPreview();
	});

	async function doImport() {
		const di = headers.indexOf(colMap.date);
		const ai = headers.indexOf(colMap.amount);
		const ci = headers.indexOf(colMap.category);
		const dsi = headers.indexOf(colMap.description);

		const rows = rawRows.map((row) => {
			const dateRaw = di >= 0 ? (row[di] ?? '') : '';
			const amountRaw = ai >= 0 ? String(row[ai] ?? '') : '';
			const amount = parseBRLAmount(amountRaw);
			return {
				date: parseDate(dateRaw as string | number) ?? '',
				amount: isNaN(amount) ? 0 : Math.abs(amount),
				categoryCode: ci >= 0 ? String(row[ci] ?? '').trim().toUpperCase() : '',
				description: dsi >= 0 ? String(row[dsi] ?? '') : ''
			};
		});

		importing = true;
		try {
			const res = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows })
			});
			result = await res.json();
			file = null;
			preview = [];
			rawRows = [];
		} catch {
			error = 'Erro ao importar. Tente novamente.';
		} finally {
			importing = false;
		}
	}

	const validCount = $derived(preview.filter((r) => r.valid).length);
	const totalToImport = $derived(rawRows.length);

	// ── Open Finance / Pluggy ─────────────────────────────────────────────────
	type PluggyTx = {
		id: string;
		date: string;
		description: string;
		amount: number;
		type: 'DEBIT' | 'CREDIT';
		accountName: string;
		accountType: string;
		status: string;
		categoryCode: string;
	};

	let ofStep = $state<'idle' | 'connecting' | 'fetching' | 'preview' | 'done'>('idle');
	let ofError = $state('');
	let ofResult = $state<{ imported: number; skipped: number } | null>(null);
	let ofTransactions = $state<PluggyTx[]>([]);
	let ofImporting = $state(false);
	let ofBulkCategory = $state('');
	let ofSyncFrom = $state('');
	let ofSyncTo = $state('');

	async function startPluggyConnect() {
		ofError = '';
		ofStep = 'connecting';

		try {
			const tokenRes = await fetch('/api/pluggy/connect-token', { method: 'POST' });
			if (!tokenRes.ok) {
				const msg = await tokenRes.text();
				throw new Error(msg || `HTTP ${tokenRes.status}`);
			}
			const { accessToken } = await tokenRes.json();

			await loadPluggyScript();

			const pluggyConnect = new (window as Window & { PluggyConnect: new (opts: unknown) => { init(): void } }).PluggyConnect({
				connectToken: accessToken,
				includeSandbox: true,
				onSuccess: async (itemData: { item: { id: string; connector?: { name?: string } } }) => {
					ofStep = 'fetching';
					// Persist item so background auto-sync can use it
					await fetch('/api/pluggy/save-item', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							itemId: itemData.item.id,
							name: itemData.item.connector?.name ?? 'Banco'
						})
					});
					await fetchPluggyTransactions(itemData.item.id);
				},
				onError: (err: { message?: string }) => {
					ofError = err?.message ?? 'Erro na conexão com o banco.';
					ofStep = 'idle';
				},
				onClose: () => {
					if (ofStep === 'connecting') ofStep = 'idle';
				}
			});
			pluggyConnect.init();
		} catch (e) {
			ofError = e instanceof Error ? e.message : 'Erro ao iniciar conexão.';
			ofStep = 'idle';
		}
	}

	function loadPluggyScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			if ((window as Window & { PluggyConnect?: unknown }).PluggyConnect) { resolve(); return; }
			const script = document.createElement('script');
			script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Falha ao carregar widget Pluggy'));
			document.head.appendChild(script);
		});
	}

	async function fetchPluggyTransactions(itemId: string) {
		try {
			const res = await fetch('/api/pluggy/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId })
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json() as {
				transactions: Omit<PluggyTx, 'categoryCode'>[];
				syncFrom: string;
				syncTo: string;
			};
			ofTransactions = data.transactions.map((t) => ({ ...t, categoryCode: '' }));
			ofSyncFrom = data.syncFrom;
			ofSyncTo = data.syncTo;
			ofStep = 'preview';
		} catch (e) {
			ofError = e instanceof Error ? e.message : 'Erro ao buscar transações.';
			ofStep = 'idle';
		}
	}

	function applyBulkCategory() {
		if (!ofBulkCategory) return;
		ofTransactions = ofTransactions.map((t) => ({ ...t, categoryCode: ofBulkCategory }));
	}

	async function doPluggyImport() {
		const rows = ofTransactions
			.filter((t) => t.categoryCode)
			.map((t) => ({
				date: t.date,
				amount: t.amount,
				categoryCode: t.categoryCode,
				description: t.description
			}));

		ofImporting = true;
		try {
			const res = await fetch('/api/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows })
			});
			ofResult = await res.json();
			// Save sync date so next run starts from today
			await fetch('/api/pluggy/sync-complete', { method: 'POST' });
			ofStep = 'done';
		} catch {
			ofError = 'Erro ao importar. Tente novamente.';
		} finally {
			ofImporting = false;
		}
	}

	function resetPluggy() {
		ofStep = 'idle';
		ofError = '';
		ofResult = null;
		ofTransactions = [];
		ofBulkCategory = '';
		ofSyncFrom = '';
		ofSyncTo = '';
	}

	const ofAssigned = $derived(ofTransactions.filter((t) => t.categoryCode).length);

	function fmtDate(iso: string) {
		if (!iso) return '';
		const [y, m, d] = iso.split('-');
		return `${d}/${m}/${y}`;
	}
</script>

<div class="p-8">
	<h1 class="mb-6 text-2xl font-bold text-slate-900">Importar Lançamentos</h1>

	<!-- Tabs -->
	<div class="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
		<button
			onclick={() => { activeTab = 'csv'; result = null; error = ''; }}
			class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeTab === 'csv' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
		>
			📂 CSV / XLSX
		</button>
		<button
			onclick={() => { activeTab = 'openfinance'; ofResult = null; ofError = ''; }}
			class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {activeTab === 'openfinance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
		>
			🏦 Open Finance
		</button>
	</div>

	<!-- ── CSV / XLSX Tab ──────────────────────────────────────────────────── -->
	{#if activeTab === 'csv'}
		{#if result}
			<div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
				<div class="text-lg font-semibold text-emerald-700">✅ Importação concluída!</div>
				<div class="mt-1 text-sm text-emerald-600">
					{result.imported} lançamento(s) importado(s){result.skipped > 0 ? `, ${result.skipped} ignorado(s) (categoria não encontrada ou dados inválidos)` : ''}.
				</div>
				<button onclick={() => (result = null)} class="mt-3 text-sm text-emerald-700 underline">Importar mais</button>
			</div>
		{/if}

		{#if error}
			<div class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
		{/if}

		{#if !rawRows.length}
			<div
				role="region"
				aria-label="Área de upload"
				class="mb-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-colors
				       {dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400'}"
				ondragover={(e) => { e.preventDefault(); dragging = true; }}
				ondragleave={() => (dragging = false)}
				ondrop={(e) => { e.preventDefault(); dragging = false; const f = e.dataTransfer?.files[0]; if (f) handleFileSelect(f); }}
			>
				<div class="mb-3 text-4xl">📂</div>
				<div class="mb-1 text-sm font-medium text-slate-700">Arraste um arquivo CSV ou XLSX aqui</div>
				<div class="mb-4 text-xs text-slate-400">ou clique para selecionar</div>
				<label class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
					Selecionar arquivo
					<input type="file" accept=".csv,.xlsx,.xls" class="hidden" onchange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSelect(f); }} />
				</label>
			</div>

			<div class="rounded-xl border border-slate-100 bg-slate-50 p-5">
				<div class="mb-2 text-sm font-semibold text-slate-700">📋 Formato esperado</div>
				<div class="text-xs text-slate-500">
					Colunas reconhecidas automaticamente por nome: <br />
					<code class="mt-1 block rounded bg-white p-2 font-mono text-slate-700">
						Data | Valor | Categoria | Descrição
					</code>
					<br />
					A coluna <strong>Categoria</strong> deve conter o código da planilha (ex: <code>A1</code>, <code>R1</code>, <code>M5</code>).<br />
					Datas aceitas: <code>DD/MM/AAAA</code> ou <code>AAAA-MM-DD</code>.<br />
					Valores aceitos: <code>1250,00</code> ou <code>1.250,99</code>.
				</div>
			</div>
		{:else}
			<div class="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div class="mb-4 text-sm font-semibold text-slate-700">Mapeamento de colunas</div>
				<div class="grid grid-cols-4 gap-4">
					{#each [['date','📅 Data'],['amount','💰 Valor'],['category','🏷️ Categoria'],['description','📝 Descrição']] as [key, label]}
						<div>
							<label class="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
							<select
								value={colMap[key as keyof typeof colMap]}
								onchange={(e) => { colMap = { ...colMap, [key]: (e.target as HTMLSelectElement).value }; }}
								class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
							>
								<option value="">— ignorar —</option>
								{#each headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
			</div>

			<div class="mb-5 rounded-xl border border-slate-100 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
					<span class="text-sm font-semibold text-slate-700">Preview (primeiras 20 linhas)</span>
					<span class="text-xs text-slate-400">{validCount}/{Math.min(rawRows.length, 20)} válidas</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead class="bg-slate-50 text-slate-500">
							<tr>
								<th class="px-4 py-2 text-left">Data</th>
								<th class="px-4 py-2 text-left">Categoria</th>
								<th class="px-4 py-2 text-left">Descrição</th>
								<th class="px-4 py-2 text-right">Valor</th>
								<th class="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50">
							{#each preview as row}
								<tr class="{row.valid ? '' : 'opacity-40'} hover:bg-slate-50/50">
									<td class="px-4 py-2">{row.date ?? '—'}</td>
									<td class="px-4 py-2 font-mono">{row.categoryCode || '—'}</td>
									<td class="px-4 py-2">{row.description || '—'}</td>
									<td class="px-4 py-2 text-right font-medium">R$ {row.amount.toFixed(2)}</td>
									<td class="px-4 py-2 text-center">{row.valid ? '✅' : '⚠️'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<button
					onclick={doImport}
					disabled={importing}
					class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
				>
					{importing ? 'Importando...' : `Importar ${totalToImport} lançamento(s)`}
				</button>
				<button
					onclick={() => { file = null; preview = []; rawRows = []; headers = []; error = ''; }}
					class="text-sm text-slate-500 hover:text-slate-700"
				>
					← Voltar
				</button>
			</div>
		{/if}
	{/if}

	<!-- ── Open Finance Tab ───────────────────────────────────────────────── -->
	{#if activeTab === 'openfinance'}
		{#if ofError}
			<div class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ofError}</div>
		{/if}

		<!-- Done -->
		{#if ofStep === 'done' && ofResult}
			<div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
				<div class="text-lg font-semibold text-emerald-700">✅ Importação concluída!</div>
				<div class="mt-1 text-sm text-emerald-600">
					{ofResult.imported} lançamento(s) importado(s){ofResult.skipped > 0 ? `, ${ofResult.skipped} ignorado(s)` : ''}.
				</div>
				<p class="mt-1 text-xs text-emerald-500">Próxima sincronização continuará a partir de hoje.</p>
				<button onclick={resetPluggy} class="mt-3 text-sm text-emerald-700 underline">Importar mais</button>
			</div>
		{/if}

		<!-- Idle: connect button -->
		{#if ofStep === 'idle'}
			<div class="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center gap-3">
					<span class="text-3xl">🏦</span>
					<div>
						<div class="font-semibold text-slate-900">Conectar conta bancária</div>
						<div class="text-sm text-slate-500">Via Open Finance — powered by Pluggy</div>
					</div>
				</div>
				<p class="mb-4 text-sm text-slate-600">
					Conecte sua conta diretamente ao banco para importar transações automaticamente.
				</p>

				<!-- Auto period info -->
				<div class="mb-5 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
					<span>📅</span>
					{#if data.pluggyLastSync}
						Período: <strong class="text-slate-700">{fmtDate(data.pluggyLastSync)}</strong> até hoje
						<span class="ml-1 text-slate-400">(desde a última sincronização)</span>
					{:else}
						Período: últimos <strong class="text-slate-700">90 dias</strong>
						<span class="ml-1 text-slate-400">(primeira sincronização)</span>
					{/if}
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={startPluggyConnect}
						class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
					>
						Conectar banco →
					</button>
					{#if data.pluggyLastSync}
						<span class="text-xs text-slate-400">Última sync: {fmtDate(data.pluggyLastSync)}</span>
					{/if}
				</div>
			</div>

			<div class="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
				⚠️ <strong>Configuração necessária:</strong> acesse
				<a href="/settings" class="underline font-medium">Configurações → Open Finance</a>
				e cadastre o <code>Client ID</code> e <code>Client Secret</code> da sua conta Pluggy.
			</div>
		{/if}

		<!-- Connecting / Fetching -->
		{#if ofStep === 'connecting' || ofStep === 'fetching'}
			<div class="flex items-center gap-3 text-slate-600">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
				<span class="text-sm">{ofStep === 'connecting' ? 'Abrindo widget de conexão...' : 'Buscando transações...'}</span>
			</div>
		{/if}

		<!-- Preview -->
		{#if ofStep === 'preview'}
			<div class="mb-4 flex items-center justify-between">
				<div class="text-sm text-slate-600">
					<strong>{ofTransactions.length}</strong> transação(ões) de <strong>{fmtDate(ofSyncFrom)}</strong> a <strong>{fmtDate(ofSyncTo)}</strong> &mdash;
					<span class="{ofAssigned === ofTransactions.length ? 'text-emerald-600' : 'text-amber-600'}">{ofAssigned} categorizadas</span>
				</div>
				<button onclick={resetPluggy} class="text-xs text-slate-400 hover:text-slate-600">← Voltar</button>
			</div>

			<!-- Bulk category assign -->
			<div class="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
				<span class="text-xs text-slate-500">Categoria para todas:</span>
				<select
					bind:value={ofBulkCategory}
					class="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
				>
					<option value="">— selecionar —</option>
					{#each data.categories as cat}
						<option value={cat.code}>[{cat.code}] {cat.name}</option>
					{/each}
				</select>
				<button
					onclick={applyBulkCategory}
					disabled={!ofBulkCategory}
					class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
				>
					Aplicar
				</button>
			</div>

			<!-- Transactions table -->
			<div class="mb-5 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead class="bg-slate-50 text-slate-500">
							<tr>
								<th class="px-3 py-2 text-left">Data</th>
								<th class="px-3 py-2 text-left">Conta</th>
								<th class="px-3 py-2 text-left">Descrição</th>
								<th class="px-3 py-2 text-right">Valor</th>
								<th class="px-3 py-2 text-left">Categoria</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50">
							{#each ofTransactions as tx}
								<tr class="hover:bg-slate-50/50 {!tx.categoryCode ? 'opacity-60' : ''}">
									<td class="px-3 py-2 text-slate-500">{tx.date}</td>
									<td class="px-3 py-2 text-slate-400 text-[11px]">{tx.accountName}</td>
									<td class="px-3 py-2 max-w-xs truncate" title={tx.description}>{tx.description}</td>
									<td class="px-3 py-2 text-right font-medium {tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}">
										{tx.type === 'CREDIT' ? '+' : '-'}R$ {tx.amount.toFixed(2)}
									</td>
									<td class="px-3 py-2">
										<select
											value={tx.categoryCode}
											onchange={(e) => {
												const code = (e.target as HTMLSelectElement).value;
												ofTransactions = ofTransactions.map((t) => t.id === tx.id ? { ...t, categoryCode: code } : t);
											}}
											class="w-full rounded border border-slate-200 px-1.5 py-1 text-[11px]"
										>
											<option value="">— sem categoria —</option>
											{#each data.categories as cat}
												<option value={cat.code}>[{cat.code}] {cat.name}</option>
											{/each}
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<button
					onclick={doPluggyImport}
					disabled={ofImporting || ofAssigned === 0}
					class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
				>
					{ofImporting ? 'Importando...' : `Importar ${ofAssigned} lançamento(s)`}
				</button>
				<span class="text-xs text-slate-400">
					{ofTransactions.length - ofAssigned > 0 ? `${ofTransactions.length - ofAssigned} sem categoria serão ignorados` : 'Todos categorizados ✅'}
				</span>
			</div>
		{/if}
	{/if}
</div>
