import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pluggyItems } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { itemId, name } = (await request.json()) as { itemId: string; name?: string };
		if (!itemId) throw error(400, 'itemId obrigatório');

		const existing = db.select().from(pluggyItems).where(eq(pluggyItems.id, itemId)).get();
		if (!existing) {
			db.insert(pluggyItems)
				.values({ id: itemId, name: name || 'Banco' })
				.run();
		}

		return json({ ok: true });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(500, e instanceof Error ? e.message : 'Erro ao salvar item');
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const { itemId } = (await request.json()) as { itemId: string };
		if (!itemId) throw error(400, 'itemId obrigatório');
		db.delete(pluggyItems).where(eq(pluggyItems.id, itemId)).run();
		return json({ ok: true });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(500, e instanceof Error ? e.message : 'Erro ao remover item');
	}
};
