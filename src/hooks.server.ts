import { runAutoSync } from '$lib/server/pluggy-sync';
import { getSetting } from '$lib/server/db/settings';
import type { Handle } from '@sveltejs/kit';

const DEFAULT_INTERVAL_HOURS = 4;

function startAutoSync() {
	const run = async () => {
		try {
			await runAutoSync();
		} catch (e) {
			console.error('[Pluggy auto-sync] Erro inesperado:', e);
		}
	};

	// Run once 10 seconds after server start to avoid blocking startup
	setTimeout(run, 10_000);

	// Then run periodically
	const scheduleNext = async () => {
		await run();
		const hours = parseInt(getSetting('pluggy_sync_interval_hours', String(DEFAULT_INTERVAL_HOURS)));
		const interval = (isNaN(hours) || hours < 1 ? DEFAULT_INTERVAL_HOURS : hours) * 60 * 60 * 1000;
		setTimeout(scheduleNext, interval);
	};

	const hours = parseInt(getSetting('pluggy_sync_interval_hours', String(DEFAULT_INTERVAL_HOURS)));
	const interval = (isNaN(hours) || hours < 1 ? DEFAULT_INTERVAL_HOURS : hours) * 60 * 60 * 1000;
	setTimeout(scheduleNext, interval);
}

let syncStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!syncStarted) {
		syncStarted = true;
		startAutoSync();
	}
	return resolve(event);
};
