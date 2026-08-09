import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setSetting } from '$lib/server/db/settings';

export const POST: RequestHandler = async () => {
	const today = new Date().toISOString().substring(0, 10);
	setSetting('pluggy_last_sync', today);
	return json({ lastSync: today });
};
