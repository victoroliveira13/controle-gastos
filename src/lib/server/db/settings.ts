import { db } from './index';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

export function getSetting(key: string, defaultValue = '0'): string {
	const row = db.select().from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
	db.insert(settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } })
		.run();
}

export function getInitialBalance(): number {
	return parseFloat(getSetting('initial_balance', '0')) || 0;
}
