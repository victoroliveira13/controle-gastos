import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { goals } from '$lib/server/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

function parseAmount(raw: FormDataEntryValue | null) {
	return parseFloat(String(raw ?? '').replace(/\./g, '').replace(',', '.')) || 0;
}

function readGoal(fd: FormData) {
	return {
		name: String(fd.get('name') ?? '').trim(),
		targetAmount: parseAmount(fd.get('targetAmount')),
		targetDate: (fd.get('targetDate') as string) || null,
		priority: Number(fd.get('priority')) || 1,
		notes: (fd.get('notes') as string)?.trim() || null
	};
}

export const load: PageServerLoad = () => {
	const rows = db.select().from(goals).orderBy(asc(goals.priority), asc(goals.id)).all();
	return { goals: rows };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const g = readGoal(await request.formData());
		if (!g.name) return fail(400, { error: 'Nome obrigatório' });
		if (g.targetAmount <= 0) return fail(400, { error: 'Valor da meta inválido' });
		db.insert(goals).values(g).run();
		return { success: true };
	},

	update: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const g = readGoal(fd);
		if (!id) return fail(400, { error: 'ID inválido' });
		if (!g.name) return fail(400, { error: 'Nome obrigatório' });
		if (g.targetAmount <= 0) return fail(400, { error: 'Valor da meta inválido' });
		db.update(goals).set(g).where(eq(goals.id, id)).run();
		return { success: true };
	},

	// Guardar (valor positivo) ou retirar (valor negativo) dinheiro da meta
	contribute: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const amount = parseAmount(fd.get('amount'));
		const sign = fd.get('direction') === 'out' ? -1 : 1;
		if (!id || amount <= 0) return fail(400, { error: 'Valor inválido' });
		db.update(goals)
			.set({ savedAmount: sql`MAX(0, ROUND(${goals.savedAmount} + ${sign * amount}, 2))` })
			.where(eq(goals.id, id))
			.run();
		return { success: true };
	},

	delete: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		if (!id) return fail(400, { error: 'ID inválido' });
		db.delete(goals).where(eq(goals.id, id)).run();
		return { success: true };
	}
};
