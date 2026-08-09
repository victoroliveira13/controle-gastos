/**
 * Background auto-sync service for Pluggy Open Finance.
 * Fetches new transactions for all stored items and inserts them
 * into the transactions table, deduplicating by pluggy_tx_id.
 */
import { db, client } from '$lib/server/db';
import { pluggyItems, transactions } from '$lib/server/db/schema';
import { getSetting, setSetting } from '$lib/server/db/settings';
import { getAccounts, getTransactions, isPluggyConfigured } from '$lib/server/pluggy';
import { eq } from 'drizzle-orm';

export type SyncResult = {
	inserted: number;
	skipped: number;
	errors: string[];
};

function getDefaultCategoryId(isIncome: boolean): number | null {
	// Honour user-configured default categories
	const key = isIncome ? 'pluggy_default_income_category' : 'pluggy_default_expense_category';
	const configured = getSetting(key, '');
	if (configured) {
		const id = parseInt(configured);
		if (!isNaN(id)) return id;
	}

	// Fall back to first active category of the right income type
	const row = client
		.prepare(
			`SELECT c.id FROM categories c
			 JOIN category_groups cg ON cg.id = c.group_id
			 WHERE c.is_active = 1 AND cg.is_income = ?
			 LIMIT 1`
		)
		.get(isIncome ? 1 : 0) as { id: number } | undefined;
	return row?.id ?? null;
}

export async function runAutoSync(): Promise<SyncResult> {
	const result: SyncResult = { inserted: 0, skipped: 0, errors: [] };

	if (!isPluggyConfigured()) {
		result.errors.push('Credenciais Pluggy não configuradas');
		return result;
	}

	const items = db.select().from(pluggyItems).all();
	if (items.length === 0) {
		return result; // nothing to sync
	}

	const lastSync = getSetting('pluggy_last_sync', '');
	const from = lastSync || (() => {
		const d = new Date();
		d.setDate(d.getDate() - 90);
		return d.toISOString().substring(0, 10);
	})();
	const to = new Date().toISOString().substring(0, 10);

	for (const item of items) {
		try {
			const accounts = await getAccounts(item.id);
			for (const account of accounts) {
				const txs = await getTransactions(account.id, from, to);
				for (const tx of txs) {
					if (tx.status !== 'POSTED') { result.skipped++; continue; }

					// Deduplicate
					const exists = db
						.select({ id: transactions.id })
						.from(transactions)
						.where(eq(transactions.pluggyTxId, tx.id))
						.get();
					if (exists) { result.skipped++; continue; }

					const isIncome = tx.type === 'CREDIT';
					const categoryId = getDefaultCategoryId(isIncome);
					if (!categoryId) {
						result.errors.push(`Categoria padrão não encontrada para transação ${tx.id}`);
						result.skipped++;
						continue;
					}

					db.insert(transactions)
						.values({
							categoryId,
							amount: Math.abs(tx.amount),
							type: isIncome ? 'income' : 'expense',
							date: tx.date.substring(0, 10),
							description: tx.description,
							pluggyTxId: tx.id
						})
						.run();
					result.inserted++;
				}
			}
		} catch (e) {
			result.errors.push(`Item ${item.id}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	// Update last sync date only if we actually processed something
	if (result.errors.length === 0 || result.inserted > 0) {
		setSetting('pluggy_last_sync', to);
	}

	setSetting('pluggy_last_sync_status', JSON.stringify({
		at: new Date().toISOString(),
		inserted: result.inserted,
		skipped: result.skipped,
		errors: result.errors
	}));

	console.log(`[Pluggy auto-sync] ${result.inserted} inseridas, ${result.skipped} ignoradas, ${result.errors.length} erros`);
	return result;
}
