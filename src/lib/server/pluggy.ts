import { env } from '$env/dynamic/private';
import { getSetting } from '$lib/server/db/settings';

const PLUGGY_API = 'https://api.pluggy.ai';

let cachedApiKey: { key: string; expiresAt: number } | null = null;

function getCredentials(): { clientId: string; clientSecret: string } {
	// DB settings take priority; fall back to env vars
	const clientId = getSetting('pluggy_client_id', '') || env.PLUGGY_CLIENT_ID || '';
	const clientSecret = getSetting('pluggy_client_secret', '') || env.PLUGGY_CLIENT_SECRET || '';
	if (!clientId || !clientSecret) {
		throw new Error('Credenciais Pluggy não configuradas. Acesse Configurações → Pluggy.');
	}
	return { clientId, clientSecret };
}

async function getApiKey(): Promise<string> {
	const { clientId, clientSecret } = getCredentials();

	if (cachedApiKey && Date.now() < cachedApiKey.expiresAt) {
		return cachedApiKey.key;
	}
	const res = await fetch(`${PLUGGY_API}/auth`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			clientId,
			clientSecret
		})
	});
	if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status} ${await res.text()}`);
	const { apiKey } = await res.json();
	// API key expires in 2h; cache for 90min to be safe
	cachedApiKey = { key: apiKey, expiresAt: Date.now() + 90 * 60 * 1000 };
	return apiKey;
}

export function invalidatePluggyCache(): void {
	cachedApiKey = null;
}

export function isPluggyConfigured(): boolean {
	try {
		getCredentials();
		return true;
	} catch {
		return false;
	}
}

export async function createConnectToken(itemId?: string): Promise<string> {
	const apiKey = await getApiKey();
	const body: Record<string, unknown> = {};
	if (itemId) body.itemId = itemId;

	const res = await fetch(`${PLUGGY_API}/connect_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`Pluggy connect token failed: ${res.status} ${await res.text()}`);
	const { accessToken } = await res.json();
	return accessToken;
}

export type PluggyAccount = {
	id: string;
	name: string;
	type: string;
	subtype: string;
	balance: number;
	currencyCode: string;
	institution?: { name: string };
};

export async function getAccounts(itemId: string): Promise<PluggyAccount[]> {
	const apiKey = await getApiKey();
	const res = await fetch(`${PLUGGY_API}/accounts?itemId=${encodeURIComponent(itemId)}`, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!res.ok) throw new Error(`Pluggy accounts failed: ${res.status} ${await res.text()}`);
	const { results } = await res.json();
	return results as PluggyAccount[];
}

export type PluggyTransaction = {
	id: string;
	description: string;
	descriptionRaw?: string;
	amount: number;
	date: string;
	type: 'DEBIT' | 'CREDIT';
	currencyCode: string;
	status: 'POSTED' | 'PENDING';
	category?: string | null;
};

export async function getTransactions(
	accountId: string,
	from?: string,
	to?: string
): Promise<PluggyTransaction[]> {
	const apiKey = await getApiKey();
	const params = new URLSearchParams({ accountId, pageSize: '500' });
	if (from) params.set('from', from);
	if (to) params.set('to', to);

	const res = await fetch(`${PLUGGY_API}/transactions?${params}`, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!res.ok) throw new Error(`Pluggy transactions failed: ${res.status} ${await res.text()}`);
	const { results, total } = (await res.json()) as { results: PluggyTransaction[]; total: number };

	let all = [...results];

	if (total > 500) {
		const totalPages = Math.ceil(total / 500);
		for (let page = 2; page <= totalPages; page++) {
			params.set('page', String(page));
			const pageRes = await fetch(`${PLUGGY_API}/transactions?${params}`, {
				headers: { 'X-API-KEY': apiKey }
			});
			if (pageRes.ok) {
				const pageData = (await pageRes.json()) as { results: PluggyTransaction[] };
				all = all.concat(pageData.results);
			}
		}
	}

	return all;
}
