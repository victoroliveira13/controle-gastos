import { describe, it, expect, vi } from 'vitest';

vi.mock('./db/index', () => ({ db: {} }));
vi.mock('./db/settings', () => ({ getSetting: () => '' }));

import { nthBusinessDay, nextSalaryDate, iso } from './projection';

describe('nthBusinessDay', () => {
	it('nov/2026: 5º dia útil é 06/11', () => {
		expect(iso(nthBusinessDay(2026, 11, 5))).toBe('2026-11-06');
	});
	it('out/2026: 5º dia útil é 07/10', () => {
		expect(iso(nthBusinessDay(2026, 10, 5))).toBe('2026-10-07');
	});
});

describe('nextSalaryDate', () => {
	it('em 12/10 o próximo salário é em novembro', () => {
		expect(iso(nextSalaryDate(new Date(2026, 9, 12), 5))).toBe('2026-11-06');
	});
	it('em 02/10 o salário ainda é neste mês', () => {
		expect(iso(nextSalaryDate(new Date(2026, 9, 2), 5))).toBe('2026-10-07');
	});
});
