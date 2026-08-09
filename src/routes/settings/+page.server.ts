import type { PageServerLoad, Actions } from './$types';
import { getInitialBalance, setSetting, getSetting } from '$lib/server/db/settings';
import { invalidatePluggyCache } from '$lib/server/pluggy';
import { runAutoSync } from '$lib/server/pluggy-sync';
import { db } from '$lib/server/db';
import { pluggyItems, categories, categoryGroups } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const syncStatusRaw = getSetting('pluggy_last_sync_status', '');
	let syncStatus: { at: string; inserted: number; skipped: number; errors: string[] } | null = null;
	try { if (syncStatusRaw) syncStatus = JSON.parse(syncStatusRaw); } catch { /* ignore */ }

	const expenseCategories = db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(categoryGroups.isIncome, false))
		.all();

	const incomeCategories = db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(categoryGroups.isIncome, true))
		.all();

	return {
		initialBalance: getInitialBalance(),
		pluggy: {
			clientId: getSetting('pluggy_client_id', ''),
			clientSecret: getSetting('pluggy_client_secret', ''),
			syncIntervalHours: getSetting('pluggy_sync_interval_hours', '4'),
			defaultExpenseCategoryId: getSetting('pluggy_default_expense_category', ''),
			defaultIncomeCategoryId: getSetting('pluggy_default_income_category', ''),
			lastSync: getSetting('pluggy_last_sync', ''),
			syncStatus,
			items: db.select().from(pluggyItems).all()
		},
		expenseCategories,
		incomeCategories
	};
};

export const actions: Actions = {
	saveInitialBalance: async ({ request }) => {
		const fd = await request.formData();
		const raw = fd.get('initialBalance') as string;
		const value = parseFloat(raw.replace(',', '.'));
		if (isNaN(value)) return fail(400, { error: 'Valor inválido' });
		setSetting('initial_balance', value.toString());
		return { success: true };
	},

	savePluggy: async ({ request }) => {
		const fd = await request.formData();
		const clientId = (fd.get('pluggy_client_id') as string ?? '').trim();
		const clientSecret = (fd.get('pluggy_client_secret') as string ?? '').trim();
		setSetting('pluggy_client_id', clientId);
		setSetting('pluggy_client_secret', clientSecret);
		invalidatePluggyCache();
		return { pluggySaved: true };
	},

	savePluggyConfig: async ({ request }) => {
		const fd = await request.formData();
		const hours = (fd.get('sync_interval_hours') as string ?? '').trim();
		const defExpense = (fd.get('default_expense_category') as string ?? '').trim();
		const defIncome = (fd.get('default_income_category') as string ?? '').trim();
		setSetting('pluggy_sync_interval_hours', hours || '4');
		setSetting('pluggy_default_expense_category', defExpense);
		setSetting('pluggy_default_income_category', defIncome);
		return { pluggyConfigSaved: true };
	},

	removeItem: async ({ request }) => {
		const fd = await request.formData();
		const itemId = (fd.get('item_id') as string ?? '').trim();
		if (!itemId) return fail(400, { error: 'item_id obrigatório' });
		db.delete(pluggyItems).where(eq(pluggyItems.id, itemId)).run();
		return { itemRemoved: true };
	},

	syncNow: async () => {
		const result = await runAutoSync();
		return { syncNow: true, syncResult: result };
	}
};

