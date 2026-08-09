import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAccounts, getTransactions } from '$lib/server/pluggy';
import { getSetting } from '$lib/server/db/settings';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { itemId } = (await request.json()) as { itemId: string };

		if (!itemId) throw error(400, 'itemId obrigatório');

		// Use last sync date or fall back to 90 days ago
		const lastSync = getSetting('pluggy_last_sync', '');
		const from = lastSync || (() => {
			const d = new Date();
			d.setDate(d.getDate() - 90);
			return d.toISOString().substring(0, 10);
		})();
		const to = new Date().toISOString().substring(0, 10);

		const accounts = await getAccounts(itemId);

		const rows: {
			id: string;
			date: string;
			description: string;
			amount: number;
			type: 'DEBIT' | 'CREDIT';
			accountName: string;
			accountType: string;
			status: string;
		}[] = [];

		for (const account of accounts) {
			const txs = await getTransactions(account.id, from, to);
			for (const tx of txs) {
				rows.push({
					id: tx.id,
					date: tx.date.substring(0, 10),
					description: tx.description,
					amount: Math.abs(tx.amount),
					type: tx.type,
					accountName: account.name,
					accountType: account.type,
					status: tx.status
				});
			}
		}

		rows.sort((a, b) => b.date.localeCompare(a.date));

		return json({ transactions: rows, accounts, syncFrom: from, syncTo: to });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		const msg = e instanceof Error ? e.message : 'Erro desconhecido';
		throw error(500, `Falha ao buscar transações: ${msg}`);
	}
};
