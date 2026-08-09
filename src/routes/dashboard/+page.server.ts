import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index';
import { transactions, categories, categoryGroups, budgets, monthlyNotes } from '$lib/server/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

function currentYM() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const load: PageServerLoad = ({ url }) => {
	const ym = url.searchParams.get('month') || currentYM();
	const pieFrom = url.searchParams.get('pieFrom') || ym;
	const pieTo = url.searchParams.get('pieTo') || ym;

	const summaryRows = db
		.select({
			type: transactions.type,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.where(sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`)
		.groupBy(transactions.type)
		.all();

	const income = summaryRows.find((r) => r.type === 'income')?.total ?? 0;
	const expense = summaryRows.find((r) => r.type === 'expense')?.total ?? 0;

	const breakdown = db
		.select({
			groupName: categoryGroups.name,
			groupCode: categoryGroups.code,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(
			and(eq(transactions.type, 'expense'), sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`)
		)
		.groupBy(categoryGroups.id, categoryGroups.name, categoryGroups.code)
		.orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`))
		.all();

	const pieBreakdown = db
		.select({
			groupName: categoryGroups.name,
			groupCode: categoryGroups.code,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(
			and(
				eq(transactions.type, 'expense'),
				sql`strftime('%Y-%m', ${transactions.date}) >= ${pieFrom}`,
				sql`strftime('%Y-%m', ${transactions.date}) <= ${pieTo}`
			)
		)
		.groupBy(categoryGroups.id, categoryGroups.name, categoryGroups.code)
		.orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`))
		.all();

	const evolutionRaw = db
		.select({
			month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
			type: transactions.type,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.groupBy(sql`strftime('%Y-%m', ${transactions.date})`, transactions.type)
		.orderBy(asc(sql`strftime('%Y-%m', ${transactions.date})`))
		.all();

	// Budget (previsto) per group for selected month — sum by group via categories join
	const allExpenseGroups = db
		.select({ id: categoryGroups.id, code: categoryGroups.code, name: categoryGroups.name })
		.from(categoryGroups)
		.where(eq(categoryGroups.isIncome, false))
		.all();

	const allExpenseCats = db
		.select({ id: categories.id, groupId: categories.groupId })
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(categoryGroups.isIncome, false))
		.all();

	const monthBudgets = db
		.select({
			groupCode: categoryGroups.code,
			groupId: categoryGroups.id,
			total: sql<number>`COALESCE(SUM(${budgets.amount}), 0)`
		})
		.from(budgets)
		.innerJoin(categories, eq(budgets.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(eq(budgets.month, ym))
		.groupBy(categoryGroups.id)
		.all();

	const budgetMap = Object.fromEntries(monthBudgets.map((b) => [b.groupId, b.total]));

	const budgetVsActual = allExpenseGroups
		.map((g) => ({
			groupId: g.id,
			groupCode: g.code,
			groupName: g.name,
			previsto: budgetMap[g.id] ?? 0,
			realizado: breakdown.find((b) => b.groupCode === g.code)?.total ?? 0,
			categoryIds: allExpenseCats.filter((c) => c.groupId === g.id).map((c) => c.id)
		}))
		.filter((b) => b.previsto > 0 || b.realizado > 0);

	const totalPrevisto = budgetVsActual.reduce((s, b) => s + b.previsto, 0);
	const totalRealizado = budgetVsActual.reduce((s, b) => s + b.realizado, 0);

	// Build evolution arrays from months that actually have data
	const months = [...new Set(evolutionRaw.map((r) => r.month))].sort();
	const incomeArr = months.map((key) => evolutionRaw.find((r) => r.month === key && r.type === 'income')?.total ?? 0);
	const expenseArr = months.map((key) => evolutionRaw.find((r) => r.month === key && r.type === 'expense')?.total ?? 0);

	const hasNotes = db.select({ month: monthlyNotes.month }).from(monthlyNotes).where(eq(monthlyNotes.month, ym)).get() != null;

	return { ym, income, expense, breakdown, pieBreakdown, pieFrom, pieTo, months, incomeArr, expenseArr, budgetVsActual, totalPrevisto, totalRealizado, hasNotes };
};
