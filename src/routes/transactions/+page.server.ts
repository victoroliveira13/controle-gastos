import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { transactions, categories, categoryGroups } from '$lib/server/db/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getInitialBalance } from '$lib/server/db/settings';

function currentYM() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const load: PageServerLoad = ({ url }) => {
	const ym = url.searchParams.get('month') || currentYM();
	const categoryIds = url.searchParams.getAll('categoryId').map(Number).filter(Boolean);
	const search = url.searchParams.get('q') || '';

	const conditions = [sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`];
	if (categoryIds.length > 0) conditions.push(inArray(transactions.categoryId, categoryIds));
	if (search) conditions.push(sql`LOWER(${transactions.description}) LIKE LOWER(${'%' + search + '%'})`);

	const rows = db
		.select({
			id: transactions.id,
			amount: transactions.amount,
			type: transactions.type,
			date: transactions.date,
			description: transactions.description,
			categoryId: transactions.categoryId,
			categoryName: categories.name,
			categoryCode: categories.code,
			groupName: categoryGroups.name,
			groupCode: categoryGroups.code
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(and(...conditions))
		.orderBy(asc(transactions.date), asc(transactions.id))
		.all();

	const allCategories = db
		.select({
			id: categories.id,
			code: categories.code,
			name: categories.name,
			groupCode: categoryGroups.code,
			groupName: categoryGroups.name,
			isIncome: categoryGroups.isIncome
		})
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(categories.isActive, true))
		.orderBy(sql`${categoryGroups.code} ASC`, sql`${categories.code} ASC`)
		.all();

	const summary = db
		.select({
			type: transactions.type,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(and(...conditions))
		.groupBy(transactions.type)
		.all();

	// Saldo acumulado de todos os meses ANTERIORES ao mês atual (sem filtros de categoria/busca)
	const prevSummary = db
		.select({
			type: transactions.type,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.where(sql`strftime('%Y-%m', ${transactions.date}) < ${ym}`)
		.groupBy(transactions.type)
		.all();

	const prevIncome = prevSummary.find((r) => r.type === 'income')?.total ?? 0;
	const prevExpense = prevSummary.find((r) => r.type === 'expense')?.total ?? 0;
	const previousBalance = getInitialBalance() + prevIncome - prevExpense;

	return {
		rows,
		allCategories,
		ym,
		income: summary.find((r) => r.type === 'income')?.total ?? 0,
		expense: summary.find((r) => r.type === 'expense')?.total ?? 0,
		previousBalance,
		filters: { categoryIds, search }
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const amount = parseFloat(fd.get('amount') as string);
		const type = fd.get('type') as 'income' | 'expense';
		const date = fd.get('date') as string;
		const categoryId = Number(fd.get('categoryId'));
		const description = (fd.get('description') as string) || null;

		if (!amount || amount <= 0) return fail(400, { error: 'Valor inválido' });
		if (!date) return fail(400, { error: 'Data obrigatória' });
		if (!categoryId) return fail(400, { error: 'Categoria obrigatória' });

		db.insert(transactions).values({ amount, type, date, categoryId, description }).run();
		return { success: true };
	},

	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const amount = parseFloat(fd.get('amount') as string);
		const type = fd.get('type') as 'income' | 'expense';
		const date = fd.get('date') as string;
		const categoryId = Number(fd.get('categoryId'));
		const description = (fd.get('description') as string) || null;

		if (!id) return fail(400, { error: 'ID inválido' });

		db.update(transactions)
			.set({ amount, type, date, categoryId, description })
			.where(eq(transactions.id, id))
			.run();
		return { success: true };
	},

	delete: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		if (!id) return fail(400, { error: 'ID inválido' });
		db.delete(transactions).where(eq(transactions.id, id)).run();
		return { success: true };
	}
};
