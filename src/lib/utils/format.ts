export function formatBRL(value: number): string {
	return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string): string {
	const [y, m, d] = date.split('-');
	return `${d}/${m}/${y}`;
}

export function currentYearMonth(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function prevMonth(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	const d = new Date(y, m - 2, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	const d = new Date(y, m, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
	return `${months[m - 1]} ${y}`;
}

export function todayISO(): string {
	return new Date().toISOString().split('T')[0];
}

// Parse Brazilian number format: "1.250,99" or "1250.99" or "1250,99"
export function parseBRLAmount(raw: string): number {
	const clean = raw.trim().replace(/[R$\s]/g, '');
	// "1.250,99" → "1250.99"
	if (clean.includes(',')) {
		return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
	}
	return parseFloat(clean.replace(/,/g, ''));
}

// Parse date in various formats to YYYY-MM-DD
export function parseDate(raw: string | number): string | null {
	// Excel serial number (e.g. 46055) — epoch is Dec 30, 1899
	const num = Number(raw);
	if (!isNaN(num) && num > 40000 && num < 80000) {
		const d = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
		return d.toISOString().split('T')[0];
	}

	const s = String(raw).trim();
	// DD/MM/YYYY
	const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
	// YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	// DD-MM-YYYY
	const dmY2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
	if (dmY2) return `${dmY2[3]}-${dmY2[2].padStart(2, '0')}-${dmY2[1].padStart(2, '0')}`;
	return null;
}

export const GROUP_COLORS: Record<string, string> = {
	R: '#10b981',
	A: '#f59e0b',
	M: '#3b82f6',
	E: '#8b5cf6',
	C: '#ec4899',
	S: '#ef4444',
	T: '#06b6d4',
	P: '#f97316',
	L: '#84cc16',
	F: '#6366f1'
};
