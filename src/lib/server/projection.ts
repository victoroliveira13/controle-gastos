import { db } from './db/index';
import { budgets, categories } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { getSetting } from './db/settings';

export type Commitment = { code: string; name: string; day: number };

// Contas com vencimento fixo. O valor vem do previsto da categoria no mês do vencimento.
const DEFAULT_COMMITMENTS: Commitment[] = [
	{ code: 'F6', name: 'Financiamento do carro', day: 1 },
	{ code: 'F7', name: 'Fatura do cartão', day: 28 }
];

export function getCommitments(): Commitment[] {
	try {
		const parsed = JSON.parse(getSetting('commitments', ''));
		if (Array.isArray(parsed)) return parsed;
	} catch {
		// usa o padrão
	}
	return DEFAULT_COMMITMENTS;
}

export function getSalaryBusinessDay(): number {
	const n = parseInt(getSetting('salary_business_day', '5'), 10);
	return n >= 1 && n <= 23 ? n : 5;
}

export function iso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** N-ésimo dia útil (seg–sex, feriados não contam) do mês. month é 1-12. */
export function nthBusinessDay(year: number, month: number, n: number): Date {
	const d = new Date(year, month - 1, 1);
	let count = 0;
	while (true) {
		const dow = d.getDay();
		if (dow !== 0 && dow !== 6) {
			count++;
			if (count === n) return d;
		}
		d.setDate(d.getDate() + 1);
	}
}

/** Próximo salário: o primeiro N-ésimo dia útil estritamente depois de hoje. */
export function nextSalaryDate(today: Date, n: number): Date {
	const thisMonth = nthBusinessDay(today.getFullYear(), today.getMonth() + 1, n);
	if (iso(thisMonth) > iso(today)) return thisMonth;
	return nthBusinessDay(today.getFullYear(), today.getMonth() + 2, n);
}

function budgetFor(code: string, ym: string): number {
	return (
		db
			.select({ amount: budgets.amount })
			.from(budgets)
			.innerJoin(categories, eq(budgets.categoryId, categories.id))
			.where(and(eq(categories.code, code), eq(budgets.month, ym)))
			.get()?.amount ?? 0
	);
}

/**
 * Contas que vencem depois da virada do mês e antes do próximo salário.
 * As que vencem ainda neste mês já estão no "ainda a gastar" do previsto,
 * então não entram aqui (evita contar duas vezes).
 */
export function buildProjection(today: Date) {
	const salary = nextSalaryDate(today, getSalaryBusinessDay());
	const salaryISO = iso(salary);
	const monthEnd = iso(new Date(today.getFullYear(), today.getMonth() + 1, 0));
	const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
	const nextYM = iso(next).slice(0, 7);
	const currentYM = iso(today).slice(0, 7);

	const dues = getCommitments()
		.map((c) => {
			const dueISO = `${nextYM}-${String(c.day).padStart(2, '0')}`;
			// usa o previsto do mês seguinte; se ainda não existe, repete o do mês atual
			const amount = budgetFor(c.code, nextYM) || budgetFor(c.code, currentYM);
			return { name: c.name, due: dueISO, amount };
		})
		.filter((c) => c.due > monthEnd && c.due <= salaryISO && c.amount > 0)
		.sort((a, b) => a.due.localeCompare(b.due));

	// colchão: sobra mínima desejada depois de pagar tudo até o salário
	const cushion = parseFloat(getSetting('cushion_target', '300')) || 300;

	return { salaryDate: salaryISO, dues, cushion };
}
