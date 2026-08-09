import { describe, it, expect } from 'vitest';
import {
	formatBRL,
	formatDate,
	currentYearMonth,
	prevMonth,
	nextMonth,
	monthLabel,
	parseBRLAmount,
	parseDate
} from './format';

// Intl's pt-BR currency space is a non-breaking space, so compare after
// normalizing whitespace instead of matching the exact byte sequence.
const normalizeSpaces = (s: string) => s.replace(/\s/g, ' ');

describe('formatBRL', () => {
	it('formats a positive value as BRL currency', () => {
		expect(normalizeSpaces(formatBRL(1250.5))).toBe('R$ 1.250,50');
	});

	it('formats zero', () => {
		expect(normalizeSpaces(formatBRL(0))).toBe('R$ 0,00');
	});
});

describe('formatDate', () => {
	it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
		expect(formatDate('2026-03-05')).toBe('05/03/2026');
	});
});

describe('currentYearMonth', () => {
	it('returns the current year-month in YYYY-MM format', () => {
		const now = new Date();
		const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		expect(currentYearMonth()).toBe(expected);
	});
});

describe('prevMonth / nextMonth', () => {
	it('goes to the previous month within the same year', () => {
		expect(prevMonth('2026-03')).toBe('2026-02');
	});

	it('wraps to the previous year in January', () => {
		expect(prevMonth('2026-01')).toBe('2025-12');
	});

	it('goes to the next month within the same year', () => {
		expect(nextMonth('2026-03')).toBe('2026-04');
	});

	it('wraps to the next year in December', () => {
		expect(nextMonth('2026-12')).toBe('2027-01');
	});
});

describe('monthLabel', () => {
	it('renders a short Portuguese month label with year', () => {
		expect(monthLabel('2026-03')).toBe('Mar 2026');
	});
});

describe('parseBRLAmount', () => {
	it('parses Brazilian thousands/decimal format', () => {
		expect(parseBRLAmount('1.250,99')).toBeCloseTo(1250.99);
	});

	it('parses plain comma decimal', () => {
		expect(parseBRLAmount('1250,99')).toBeCloseTo(1250.99);
	});

	it('parses plain dot decimal without thousands separator', () => {
		expect(parseBRLAmount('1250.99')).toBeCloseTo(1250.99);
	});

	it('strips currency symbol and spaces', () => {
		expect(parseBRLAmount('R$ 1.250,99')).toBeCloseTo(1250.99);
	});
});

describe('parseDate', () => {
	it('parses DD/MM/YYYY', () => {
		expect(parseDate('05/03/2026')).toBe('2026-03-05');
	});

	it('parses DD-MM-YYYY', () => {
		expect(parseDate('05-03-2026')).toBe('2026-03-05');
	});

	it('passes through YYYY-MM-DD unchanged', () => {
		expect(parseDate('2026-03-05')).toBe('2026-03-05');
	});

	it('parses an Excel serial date number', () => {
		expect(parseDate(46095)).toBe('2026-03-14');
	});

	it('returns null for unrecognized formats', () => {
		expect(parseDate('not a date')).toBeNull();
	});
});
