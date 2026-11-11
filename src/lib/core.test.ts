import { describe, expect, it } from 'vitest';
import { bulletStats, coverage, fillPlaceholders, parseJSON, redact, sourceBullets } from './core';

describe('redact: personal details never reach the AI', () => {
	const profile = { name: 'Édwige Colombani', email: 'edwige.c@gmail.com', phone: '06 12 34 56 78', linkedin: 'https://www.linkedin.com/in/edwige-c/' };
	const leaky = `Édwige COLOMBANI — edwige.c@gmail.com — +33 6 12 34 56 78 — 06.12.34.56.78
linkedin.com/in/edwige-c  other: jean@x.fr, 07 98 76 54 32, +44 7700 900123
Coordinatrice événements 2019 - 2021, budget 120 000 €. Cordialement, Edwige`;
	const { text } = redact(leaky, profile);


	it.each(['Colombani', 'COLOMBANI', 'Édwige', 'edwige', '@', '12 34', '12.34', '98 76', '7700', 'linkedin'])('hides "%s"', (personalDetail) => {
		expect(text).not.toContain(personalDetail);
	});

	it('keeps dates and amounts', () => {
		expect(text).toContain('2019 - 2021');
		expect(text).toContain('120 000');
	});

	it('signs with the name placeholder', () => expect(text).toContain('Cordialement, {{NAME}}'));

	it('hides GitHub and the personal website, keeps other links', () => {
		const linksProfile = { name: 'Adam Griffiths', github: 'https://github.com/smudgee', website: 'adamg.dev' };
		const redacted = redact('Code: github.com/smudgee/lire and https://github.com/someone-else. Site: https://www.adamg.dev/ Demo: https://lire.app', linksProfile).text;

		for (const personalDetail of ['smudgee', 'someone-else', 'adamg.dev']) expect(redacted).not.toContain(personalDetail);

		expect(redacted).toContain('{{GITHUB}}');
		expect(redacted).toContain('{{WEBSITE}}');
		expect(redacted).toContain('https://lire.app');
	});
});

describe('fillPlaceholders', () => {
	it('escapes values and leaves unknown placeholders', () => {
		expect(fillPlaceholders('<p>{{NAME}} {{EMAIL}} {{OTHER}}</p>', { name: 'A<b>', email: 'e@x' })).toBe('<p>A&lt;b&gt; e@x {{OTHER}}</p>');
	});

	it('fills links', () => {
		expect(fillPlaceholders('{{GITHUB}} {{WEBSITE}}', { github: 'https://github.com/smudgee', website: 'adamg.dev' })).toBe('https://github.com/smudgee adamg.dev');
	});
});

describe('coverage', () => {
	it('matches accents and case loosely', () => {
		expect(coverage(['Gestion budgétaire', 'Excel', 'Pronote'], 'Maîtrise d’excel et gestion budgetaire')).toEqual({
			matched: ['Gestion budgétaire', 'Excel'],
			missing: ['Pronote']
		});
	});

	it('uses English/French variants and whole words only', () => {
		const keywords = [
			{ term: 'qualité du code', variants: ['code quality', 'clean code'] },
			{ term: 'VueJS', variants: ['Vue.js', 'Vue'] },
			{ term: 'tests', variants: ['testing'] },
			{ term: 'Jquery', variants: ['jQuery'] }
		];

		const result = coverage(keywords, 'Built Vue.js components with a focus on clean code. Latest release.');

		expect(result.matched.map((keyword) => keyword.term)).toEqual(['qualité du code', 'VueJS']);
		expect(result.missing.map((keyword) => keyword.term)).toEqual(['tests', 'Jquery']); // "Latest" must not count as "test"
	});
});

describe('parseJSON', () => {
	it('reads JSON inside code fences', () => expect(parseJSON('```json\n{"a":{"b":1}}\n```')).toEqual({ a: { b: 1 } }));

	it('throws on prose', () => expect(() => parseJSON('sorry')).toThrow('BAD_JSON'));
});

describe('bullets', () => {
	it('detects bullets and scores weak openers (EN/FR) and numbers', () => {
		const careerText = `Colonia | 2024 – Present
•Built search with Vue.js
• Responsible for billing, €112k invoiced
- Chargé de la relation client
* J’ai géré 40 événements
Plain sentence, not a bullet`;

		expect(sourceBullets(careerText)).toHaveLength(4);
		expect(bulletStats(sourceBullets(careerText))).toEqual({ total: 4, action: 1, quantified: 2 });
	});
});
