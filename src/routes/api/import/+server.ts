import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { transactions, categories, categoryGroups } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

type ImportRow = { date: string; amount: number; categoryCode: string; description: string };

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { rows?: unknown };
		if (!Array.isArray(body.rows)) throw error(400, 'rows deve ser uma lista');
		const rows = body.rows as ImportRow[];

		const allCats = db
			.select({
				id: categories.id,
				code: categories.code,
				isIncome: categoryGroups.isIncome
			})
			.from(categories)
			.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
			.all();

		const codeMap = new Map(allCats.map((c) => [c.code.toUpperCase(), c]));

		const valid: { categoryId: number; amount: number; type: 'income' | 'expense'; date: string; description: string | null }[] = [];
		let skipped = 0;

		for (const row of rows) {
			const cat = codeMap.get((row.categoryCode ?? '').toUpperCase().trim());
			if (!cat || !row.date || typeof row.amount !== 'number' || isNaN(row.amount) || row.amount <= 0) {
				skipped++;
				continue;
			}
			valid.push({
				categoryId: cat.id,
				amount: row.amount,
				type: cat.isIncome ? 'income' : 'expense',
				date: row.date,
				description: row.description || null
			});
		}

		if (valid.length > 0) {
			db.insert(transactions).values(valid).run();
		}

		return json({ imported: valid.length, skipped });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(500, e instanceof Error ? e.message : 'Erro ao importar transações');
	}
};
