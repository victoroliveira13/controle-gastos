import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { monthlyNotes, transactions, categories, categoryGroups, budgets } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

function currentYM() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const load: PageServerLoad = ({ url }) => {
	const ym = url.searchParams.get('month') || currentYM();

	const notes = db.select().from(monthlyNotes).where(eq(monthlyNotes.month, ym)).get() ?? {
		month: ym,
		imprevisto: '',
		superfluous: '',
		coverage: '',
		observations: ''
	};

	const summary = db
		.select({ type: transactions.type, total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
		.from(transactions)
		.where(sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`)
		.groupBy(transactions.type)
		.all();

	const income = summary.find((r) => r.type === 'income')?.total ?? 0;
	const expense = summary.find((r) => r.type === 'expense')?.total ?? 0;

	const budgetTotal = db
		.select({ total: sql<number>`COALESCE(SUM(${budgets.amount}), 0)` })
		.from(budgets)
		.where(eq(budgets.month, ym))
		.get()?.total ?? 0;

	const overGroups = db
		.select({
			groupName: categoryGroups.name,
			previsto: sql<number>`COALESCE(SUM(${budgets.amount}), 0)`,
			realizado: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(budgets)
		.innerJoin(categories, eq(budgets.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.leftJoin(
			transactions,
			and(
				eq(transactions.categoryId, categories.id),
				sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`
			)
		)
		.where(eq(budgets.month, ym))
		.groupBy(categoryGroups.id)
		.all()
		.filter((g) => g.realizado > g.previsto);

	return { ym, notes, income, expense, balance: income - expense, budgetTotal, overGroups };
};

export const actions: Actions = {
	save: async ({ request, url }) => {
		const ym = url.searchParams.get('month') || currentYM();
		const fd = await request.formData();
		const imprevisto = (fd.get('imprevisto') as string) ?? '';
		const superfluous = (fd.get('superfluous') as string) ?? '';
		const coverage = (fd.get('coverage') as string) ?? '';
		const observations = (fd.get('observations') as string) ?? '';

		const existing = db.select().from(monthlyNotes).where(eq(monthlyNotes.month, ym)).get();
		if (existing) {
			db.update(monthlyNotes)
				.set({ imprevisto, superfluous, coverage, observations, updatedAt: new Date().toISOString() })
				.where(eq(monthlyNotes.month, ym))
				.run();
		} else {
			db.insert(monthlyNotes).values({ month: ym, imprevisto, superfluous, coverage, observations }).run();
		}
		return { success: true };
	}
};
