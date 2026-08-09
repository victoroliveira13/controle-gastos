import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { budgets, categories, categoryGroups } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

function currentYM() {
const now = new Date();
return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function nextYM(ym: string) {
	const [year, month] = ym.split('-').map(Number);
	const d = new Date(year, month, 1);
	return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export const load: PageServerLoad = ({ url }) => {
const ym = url.searchParams.get('month') || currentYM();

const groups = db
.select({ id: categoryGroups.id, code: categoryGroups.code, name: categoryGroups.name })
.from(categoryGroups)
.where(eq(categoryGroups.isIncome, false))
.all();

const groupIds = groups.map((g) => g.id);

const cats = groupIds.length
? db
.select({ id: categories.id, groupId: categories.groupId, code: categories.code, name: categories.name })
.from(categories)
.where(and(inArray(categories.groupId, groupIds), eq(categories.isActive, true)))
.all()
: [];

const existingBudgets = db
.select({ categoryId: budgets.categoryId, amount: budgets.amount })
.from(budgets)
.where(eq(budgets.month, ym))
.all();

const budgetMap = Object.fromEntries(existingBudgets.map((b) => [b.categoryId, b.amount]));

const nextMonth = nextYM(ym);
const nextHasBudget = db
	.select({ id: budgets.id })
	.from(budgets)
	.where(eq(budgets.month, nextMonth))
	.get() != null;

const result = groups.map((g) => ({
...g,
categories: cats
.filter((c) => c.groupId === g.id)
.map((c) => ({ id: c.id, code: c.code, name: c.name, amount: budgetMap[c.id] ?? 0 }))
}));

return { ym, groups: result, nextHasBudget };
};

export const actions: Actions = {
copyToNext: async ({ url }) => {
	const ym = url.searchParams.get('month') || currentYM();
	const dest = nextYM(ym);

	const current = db.select().from(budgets).where(eq(budgets.month, ym)).all();

	for (const b of current) {
		const existing = db
			.select({ id: budgets.id })
			.from(budgets)
			.where(and(eq(budgets.categoryId, b.categoryId), eq(budgets.month, dest)))
			.get();

		if (existing) {
			db.update(budgets).set({ amount: b.amount }).where(eq(budgets.id, existing.id)).run();
		} else {
			db.insert(budgets).values({ categoryId: b.categoryId, month: dest, amount: b.amount }).run();
		}
	}

	return { success: true, dest };
},

clearGroup: async ({ request, url }) => {
	const ym = url.searchParams.get('month') || currentYM();
	const form = await request.formData();
	const groupId = Number(form.get('groupId'));
	const cats = db.select({ id: categories.id }).from(categories).where(eq(categories.groupId, groupId)).all();
	const catIds = cats.map((c) => c.id);
	if (catIds.length) {
		db.delete(budgets).where(and(eq(budgets.month, ym), inArray(budgets.categoryId, catIds))).run();
	}
	return { success: true };
},

clearAll: async ({ url }) => {
	const ym = url.searchParams.get('month') || currentYM();
	db.delete(budgets).where(eq(budgets.month, ym)).run();
	return { success: true };
},

saveOne: async ({ request, url }) => {
const ym = url.searchParams.get('month') || currentYM();
const form = await request.formData();
const categoryId = Number(form.get('categoryId'));
const amount = parseFloat(String(form.get('amount') ?? '0').replace(',', '.')) || 0;

if (!categoryId) return { success: false };

const existing = db
.select({ id: budgets.id })
.from(budgets)
.where(and(eq(budgets.categoryId, categoryId), eq(budgets.month, ym)))
.get();

if (existing) {
db.update(budgets).set({ amount }).where(eq(budgets.id, existing.id)).run();
} else if (amount > 0) {
db.insert(budgets).values({ categoryId, month: ym, amount }).run();
}

return { success: true };
}
};
