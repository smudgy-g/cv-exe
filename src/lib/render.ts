// Builds the CV and cover letter HTML: single column, plain standard headings, real text = ATS friendly.
import { esc, fill, type Keyword, type Profile } from './core';

export type Lang = 'fr' | 'en';

/** What the AI returns (see ai.ts for the schema it is asked to follow). */
export interface AiResult {
	language: Lang;
	job_title?: string;
	company?: string;
	keywords?: Keyword[];
	changes?: string[];
	gaps?: string[];
	cv?: {
		headline?: string;
		summary?: string;
		skills?: { category?: string; items?: string[] }[];
		experience?: { title?: string; company?: string; location?: string; dates?: string; bullets?: string[] }[];
		education?: { degree?: string; school?: string; dates?: string; details?: string }[];
		languages?: string[];
		extra_sections?: { heading?: string; items?: string[] }[];
	};
	cover_letter?: { subject?: string; body?: string };
}

/** Section headings by CV language (also used by the ATS "standard sections" check). */
export const HEAD = {
	fr: { summary: 'Profil professionnel', skills: 'Compétences', exp: 'Expérience professionnelle', edu: 'Formation', lang: 'Langues', locale: 'fr-FR', subj: 'Objet' },
	en: { summary: 'Professional Summary', skills: 'Skills', exp: 'Professional Experience', edu: 'Education', lang: 'Languages', locale: 'en-GB', subj: 'Re' }
};

export function contactLine(p: Profile): string {
	return [p.city, p.email, p.phone, p.linkedin, p.github, p.website].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');
}

export function renderCV(r: AiResult, p: Profile): string {
	const cv = r.cv || {},
		H = HEAD[r.language] || HEAD.fr;
	const list = (a?: string[]) => (a || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
	const sec = (title: string | undefined, inner: string) => (inner ? `<h2>${esc(title)}</h2>${inner}` : '');
	const meta = (...a: (string | undefined)[]) => {
		const s = a.filter(Boolean).map(esc).join(' | ');
		return s ? `<div class="meta">${s}</div>` : '';
	};
	let h = `<h1>${esc(p.name || '{{NAME}}')}</h1>`;
	if (cv.headline) h += `<div class="headline">${esc(cv.headline)}</div>`;
	h += `<div class="contact">${contactLine(p)}</div>`;
	h += sec(H.summary, cv.summary ? `<p>${esc(cv.summary)}</p>` : '');
	h += sec(
		H.skills,
		cv.skills?.length
			? `<ul>${cv.skills.map((s) => `<li>${s.category ? `<b>${esc(s.category)} :</b> ` : ''}${(s.items || []).map(esc).join(', ')}</li>`).join('')}</ul>`
			: ''
	);
	h += sec(H.exp, (cv.experience || []).map((e) => `<h3>${esc(e.title)}${e.company ? ' — ' + esc(e.company) : ''}</h3>${meta(e.location, e.dates)}<ul>${list(e.bullets)}</ul>`).join(''));
	h += sec(H.edu, (cv.education || []).map((e) => `<h3>${esc(e.degree)}${e.school ? ' — ' + esc(e.school) : ''}</h3>${meta(e.dates)}${e.details ? `<div>${esc(e.details)}</div>` : ''}`).join(''));
	h += sec(H.lang, cv.languages?.length ? `<p>${cv.languages.map(esc).join(' &nbsp;|&nbsp; ')}</p>` : '');
	for (const x of cv.extra_sections || []) h += sec(x.heading, `<ul>${list(x.items)}</ul>`);
	return fill(h, p);
}

export function renderLetter(r: AiResult, p: Profile, today = new Date()): string {
	const H = HEAD[r.language] || HEAD.fr,
		L = r.cover_letter || {};
	const date = today.toLocaleDateString(H.locale, { day: 'numeric', month: 'long', year: 'numeric' });
	const where = r.language === 'fr' && p.city ? `${esc(p.city)}, le ` : '';
	let h = `<div class="lhead"><b>${esc(p.name || '')}</b><br>${[p.city, p.email, p.phone].filter(Boolean).map(esc).join('<br>')}</div>`;
	if (r.company) h += `<div>${esc(r.company)}</div>`;
	h += `<div class="ldate">${where}${esc(date)}</div>`;
	if (L.subject) h += `<div class="lsubj">${esc(H.subj)} : ${esc(L.subject)}</div>`;
	h += (L.body || '')
		.split(/\n\s*\n/)
		.map((par) => `<p>${esc(par.trim()).replace(/\n/g, '<br>')}</p>`)
		.join('');
	return fill(h, p);
}

/** The text the "before tailoring" keyword score is measured on. */
export function sourceText(p: Profile): string {
	return [p.experience, p.skills, p.languages].join('\n');
}
