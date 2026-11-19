<script lang="ts">
	import { parseDate, parseBRLAmount } from '$lib/utils/format';

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
</script>

<div class="px-8 pt-6 pb-8">
	<h1 class="mb-6 text-2xl font-bold text-slate-900">Importar Lançamentos</h1>

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
</div>
