import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { transactions, categories, categoryGroups, budgets, monthlyNotes } from '$lib/server/db/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { getInitialBalance } from '$lib/server/db/settings';
import { buildProjection } from '$lib/server/projection';

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
		.select({ id: categories.id, groupId: categories.groupId, name: categories.name, isActive: categories.isActive })
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

	// Parcelas deste mês já quitadas em outro mês (adiantadas): o previsto não precisa cobri-las de novo
	const prepaid = db
		.select({
			groupId: categoryGroups.id,
			total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`
		})
		.from(transactions)
		.innerJoin(categories, eq(transactions.categoryId, categories.id))
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.where(
			and(
				eq(transactions.type, 'expense'),
				eq(transactions.refMonth, ym),
				sql`strftime('%Y-%m', ${transactions.date}) != ${ym}`
			)
		)
		.groupBy(categoryGroups.id)
		.all();
	const prepaidMap = Object.fromEntries(prepaid.map((p) => [p.groupId, p.total]));

	const budgetMap = Object.fromEntries(monthBudgets.map((b) => [b.groupId, b.total]));

	const budgetVsActual = allExpenseGroups
		.map((g) => {
			const groupCats = allExpenseCats.filter((c) => c.groupId === g.id);
			const activeCats = groupCats.filter((c) => c.isActive);
			// Categoria padrão para cobrir gasto: "Outros" ativa do grupo; senão a primeira ativa
			const defaultCat = activeCats.find((c) => /^outros/i.test(c.name)) ?? activeCats[0];
			return {
				groupId: g.id,
				groupCode: g.code,
				groupName: g.name,
				previsto: Math.max((budgetMap[g.id] ?? 0) - (prepaidMap[g.id] ?? 0), 0),
				realizado: breakdown.find((b) => b.groupCode === g.code)?.total ?? 0,
				categoryIds: groupCats.map((c) => c.id),
				coverCategories: activeCats.map((c) => ({ id: c.id, name: c.name })),
				defaultCoverCategoryId: defaultCat?.id ?? null
			};
		})
		.filter((b) => b.previsto > 0 || b.realizado > 0);

	const totalPrevisto = budgetVsActual.reduce((s, b) => s + b.previsto, 0);
	const totalRealizado = budgetVsActual.reduce((s, b) => s + b.realizado, 0);

	// Build evolution arrays from months that actually have data
	const months = [...new Set(evolutionRaw.map((r) => r.month))].sort();
	const incomeArr = months.map((key) => evolutionRaw.find((r) => r.month === key && r.type === 'income')?.total ?? 0);
	const expenseArr = months.map((key) => evolutionRaw.find((r) => r.month === key && r.type === 'expense')?.total ?? 0);

	const hasNotes = db.select({ month: monthlyNotes.month }).from(monthlyNotes).where(eq(monthlyNotes.month, ym)).get() != null;

	// Saldo em conta: saldo inicial + lançamentos até hoje (mês atual) ou até o último dia do mês selecionado
	const now = new Date();
	const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	const [y, m] = ym.split('-').map(Number);
	const balanceDate =
		ym === currentYM() ? todayISO : `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
	const net = db
		.select({
			total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`
		})
		.from(transactions)
		.where(sql`${transactions.date} <= ${balanceDate}`)
		.get();
	const currentBalance = getInitialBalance() + (net?.total ?? 0);
	// Movimento de caixa do mês (por data, não por competência), até a data do saldo
	const cashNet =
		db
			.select({
				total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`
			})
			.from(transactions)
			.where(sql`strftime('%Y-%m', ${transactions.date}) = ${ym} AND ${transactions.date} <= ${balanceDate}`)
			.get()?.total ?? 0;
	const balanceIsToday = balanceDate === todayISO;

	// Projeção até o próximo salário: só faz sentido olhando o mês atual
	const projection = balanceIsToday ? buildProjection(now) : null;

	return { ym, projection, income, expense, cashNet, currentBalance, balanceDate, balanceIsToday, breakdown, pieBreakdown, pieFrom, pieTo, months, incomeArr, expenseArr, budgetVsActual, totalPrevisto, totalRealizado, hasNotes };
};

export const actions: Actions = {
	// Cobre um gasto: sobe o previsto só pela diferença que falta e lança a despesa
	cobrir: async ({ request, url }) => {
		const ym = url.searchParams.get('month') || currentYM();
		const form = await request.formData();
		const categoryId = Number(form.get('categoryId'));
		const amount = Math.round((parseFloat(String(form.get('amount') ?? '0').replace(',', '.')) || 0) * 100) / 100;
		const description = String(form.get('description') ?? '').trim() || null;

		if (!categoryId || amount <= 0) return { success: false, error: 'Valor inválido' };

		const cat = db.select({ groupId: categories.groupId }).from(categories).where(eq(categories.id, categoryId)).get();
		if (!cat) return { success: false, error: 'Categoria não encontrada' };

		const groupCatIds = db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.groupId, cat.groupId))
			.all()
			.map((c) => c.id);

		const previsto =
			db
				.select({ total: sql<number>`COALESCE(SUM(${budgets.amount}), 0)` })
				.from(budgets)
				.where(and(eq(budgets.month, ym), inArray(budgets.categoryId, groupCatIds)))
				.get()?.total ?? 0;
		const realizado =
			db
				.select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
				.from(transactions)
				.where(
					and(
						eq(transactions.type, 'expense'),
						inArray(transactions.categoryId, groupCatIds),
						sql`strftime('%Y-%m', ${transactions.date}) = ${ym}`
					)
				)
				.get()?.total ?? 0;

		// Após lançar, previsto do grupo precisa ser >= realizado
		const falta = Math.max(Math.round((realizado + amount - previsto) * 100) / 100, 0);

		const now = new Date();
		const [y, m] = ym.split('-').map(Number);
		const date =
			ym === currentYM()
				? `${ym}-${String(now.getDate()).padStart(2, '0')}`
				: `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

		db.transaction((tx) => {
			if (falta > 0) {
				const existing = tx
					.select({ id: budgets.id, amount: budgets.amount })
					.from(budgets)
					.where(and(eq(budgets.categoryId, categoryId), eq(budgets.month, ym)))
					.get();
				if (existing) {
					tx.update(budgets).set({ amount: existing.amount + falta }).where(eq(budgets.id, existing.id)).run();
				} else {
					tx.insert(budgets).values({ categoryId, month: ym, amount: falta }).run();
				}
			}
			tx.insert(transactions).values({ categoryId, amount, type: 'expense', date, description }).run();
		});

		return { success: true, adicionado: falta };
	}
};
