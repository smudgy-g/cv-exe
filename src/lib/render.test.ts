import { describe, expect, it } from 'vitest';
import { renderCV, renderLetter, type AiResult } from './render';

const profile = { name: 'Adam <G>', email: 'a@b.c', phone: '0612345678', city: 'Toulouse', github: 'https://github.com/x' };
const result: AiResult = {
	language: 'fr',
	company: 'Davidson',
	cv: {
		headline: 'Lead Developer',
		skills: [{ category: 'Front', items: ['Vue.js', 'Nuxt'] }],
		experience: [{ title: 'Lead Dev', company: 'Colonia', dates: '2026', bullets: ['Built <billing>'] }]
	},
	cover_letter: { subject: 'Candidature', body: 'Madame, Monsieur,\n\nLigne 1\nLigne 2\n\nCordialement,\n{{NAME}}' }
};

describe('renderCV', () => {
	const html = renderCV(result, profile);

	it('uses French standard headings and escapes everything', () => {
		expect(html).toContain('<h2>Compétences</h2>');
		expect(html).toContain('<h1>Adam &lt;G&gt;</h1>');
		expect(html).toContain('<li>Built &lt;billing&gt;</li>');
	});

	it('puts contact details and links back in locally, with real text separators', () => {
		const separator = '<span class="sep"> · </span>';

		expect(html).toContain(['Toulouse', 'a@b.c', '0612345678', 'https://github.com/x'].join(separator));
	});

	it('marks up title, organisation and dates separately, in reading order', () => {
		expect(html).toContain('<div class="job"><h3>Lead Dev</h3><div class="meta"><span class="org">Colonia</span><span class="sep sep-when"> · </span><span class="when">2026</span></div>');

		const text = html.replace(/<[^>]+>/g, '');

		expect(text).toContain('Lead DevColonia · 2026Built'); // ATS reads title, company, dates, then bullets
	});

	it('skips empty sections', () => expect(html).not.toContain('Formation'));
});

describe('renderLetter', () => {
	const html = renderLetter(result, profile, new Date(2026, 10, 10));

	it('dates French letters with the city', () => expect(html).toContain('Toulouse, le 10 novembre 2026'));

	it('keeps paragraphs and line breaks, and signs with the real name', () => {
		expect(html).toContain('<p>Ligne 1<br>Ligne 2</p>');
		expect(html).toContain('Cordialement,<br>Adam &lt;G&gt;');
	});
});
