import { describe, expect, it } from 'vitest';
import { Invalid, toEdits, toNewApplication, toProfile } from './records';

describe('toProfile', () => {
	it('keeps known text fields, fills the rest with empty strings, drops unknown keys', () => {
		const p = toProfile({ name: 'Adam', experience: 'Colonia', admin: true });
		expect(p.name).toBe('Adam');
		expect(p.extraSkills).toBe('');
		expect(p).not.toHaveProperty('admin');
	});
	it('rejects non-text and oversized values', () => {
		expect(() => toProfile({ name: 42 })).toThrow(Invalid);
		expect(() => toProfile({ name: 'x'.repeat(501) })).toThrow(Invalid);
		expect(() => toProfile(null)).toThrow(Invalid);
	});
});

describe('toNewApplication', () => {
	const base = { ad: 'ad', sent: 'sent', result: { language: 'en', job_title: 'Dev' }, cvHtml: '<h1>x</h1>', letterHtml: '<p>y</p>' };
	it('accepts an old backup entry', () => {
		const a = toNewApplication({ ...base, id: 1731234567890, date: '2026-11-10T09:00:00.000Z', beforeMatched: ['Vue', 3], beforeBullets: { total: 4, action: 1, quantified: 2 } });
		expect(a.date).toBe('2026-11-10T09:00:00.000Z');
		expect(a.beforeMatched).toEqual(['Vue']);
		expect(a.beforeBullets).toEqual({ total: 4, action: 1, quantified: 2 });
		expect(a).not.toHaveProperty('id'); // the server assigns ids
	});
	it('defaults an unknown language to French and tolerates missing extras', () => {
		const a = toNewApplication({ ...base, result: { language: 'de' } });
		expect(a.result.language).toBe('fr');
		expect(a.beforeBullets).toBeNull();
		expect(a.date).toBeUndefined();
	});
	it('rejects a missing result', () => expect(() => toNewApplication({ ...base, result: 'x' })).toThrow(Invalid));
});

describe('toEdits', () => {
	it('keeps only the edited documents', () => expect(toEdits({ cvHtml: '<p>a</p>', other: 1 })).toEqual({ cvHtml: '<p>a</p>' }));
	it('rejects an empty edit', () => expect(() => toEdits({})).toThrow(Invalid));
});
