import { describe, expect, it } from 'vitest';
import { renderCV, renderLetter, type AiResult } from './render';

const p = { name: 'Adam <G>', email: 'a@b.c', phone: '0612345678', city: 'Toulouse', github: 'https://github.com/x' };
const r: AiResult = {
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
	const html = renderCV(r, p);
	it('uses French standard headings and escapes everything', () => {
		expect(html).toContain('<h2>Compétences</h2>');
		expect(html).toContain('<h1>Adam &lt;G&gt;</h1>');
		expect(html).toContain('<li>Built &lt;billing&gt;</li>');
	});
	it('puts contact details and links back in locally', () => expect(html).toContain('Toulouse &nbsp;|&nbsp; a@b.c &nbsp;|&nbsp; 0612345678 &nbsp;|&nbsp; https://github.com/x'));
	it('skips empty sections', () => expect(html).not.toContain('Formation'));
});

describe('renderLetter', () => {
	const html = renderLetter(r, p, new Date(2026, 10, 10));
	it('dates French letters with the city', () => expect(html).toContain('Toulouse, le 10 novembre 2026'));
	it('keeps paragraphs and line breaks, and signs with the real name', () => {
		expect(html).toContain('<p>Ligne 1<br>Ligne 2</p>');
		expect(html).toContain('Cordialement,<br>Adam &lt;G&gt;');
	});
});
