import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createConnectToken } from '$lib/server/pluggy';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({})) as { itemId?: string };
		const accessToken = await createConnectToken(body.itemId);
		return json({ accessToken });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Erro desconhecido';
		throw error(500, msg);
	}
};
