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

/** Real text separator: the styles may restyle or hide it, but text extraction (ATS) always sees it. */
const SEP = '<span class="sep"> · </span>';

export function contactLine(p: Profile): string {
	return [p.city, p.email, p.phone, p.linkedin, p.github, p.website].filter(Boolean).map(esc).join(SEP);
}

export function renderCV(r: AiResult, p: Profile): string {
	const cv = r.cv || {},
		H = HEAD[r.language] || HEAD.fr;
	const list = (a?: string[]) => (a || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
	const sec = (title: string | undefined, inner: string) => (inner ? `<h2>${esc(title)}</h2>${inner}` : '');
	// Title on its own line; organisation/place and dates marked up separately so each style can lay them out.
	const meta = (org: string | undefined, where: string | undefined, when: string | undefined) => {
		const left = [org, where].filter(Boolean).map(esc).join(SEP);
		if (!left && !when) return '';
		const right = when ? `<span class="when">${esc(when)}</span>` : '';
		return `<div class="meta"><span class="org">${left}</span>${left && right ? '<span class="sep sep-when"> · </span>' : ''}${right}</div>`;
	};
	let h = `<div class="cvhead"><h1>${esc(p.name || '{{NAME}}')}</h1>`;
	if (cv.headline) h += `<div class="headline">${esc(cv.headline)}</div>`;
	h += `<div class="contact">${contactLine(p)}</div></div>`;
	h += sec(H.summary, cv.summary ? `<p>${esc(cv.summary)}</p>` : '');
	h += sec(
		H.skills,
		cv.skills?.length
			? `<ul>${cv.skills.map((s) => `<li>${s.category ? `<b>${esc(s.category)} :</b> ` : ''}${(s.items || []).map(esc).join(', ')}</li>`).join('')}</ul>`
			: ''
	);
	h += sec(H.exp, (cv.experience || []).map((e) => `<div class="job"><h3>${esc(e.title)}</h3>${meta(e.company, e.location, e.dates)}<ul>${list(e.bullets)}</ul></div>`).join(''));
	h += sec(H.edu, (cv.education || []).map((e) => `<div class="job"><h3>${esc(e.degree)}</h3>${meta(e.school, '', e.dates)}${e.details ? `<div class="details">${esc(e.details)}</div>` : ''}</div>`).join(''));
	h += sec(H.lang, cv.languages?.length ? `<p>${cv.languages.map(esc).join(SEP)}</p>` : '');
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
