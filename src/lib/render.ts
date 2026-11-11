// Builds the CV and cover letter HTML: single column, plain standard headings, real text = ATS friendly.
import { escapeHtml, fillPlaceholders, type Keyword, type Profile } from './core';

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
export const HEADINGS = {
	fr: {
		summary: 'Profil professionnel',
		skills: 'Compétences',
		experience: 'Expérience professionnelle',
		education: 'Formation',
		languages: 'Langues',
		locale: 'fr-FR',
		subject: 'Objet'
	},
	en: {
		summary: 'Professional Summary',
		skills: 'Skills',
		experience: 'Professional Experience',
		education: 'Education',
		languages: 'Languages',
		locale: 'en-GB',
		subject: 'Re'
	}
};

/** Real text separator: the styles may restyle or hide it, but text extraction (ATS) always sees it. */
const SEPARATOR = '<span class="sep"> · </span>';

export function contactLine(profile: Profile): string {
	return [profile.city, profile.email, profile.phone, profile.linkedin, profile.github, profile.website]
		.filter(Boolean)
		.map(escapeHtml)
		.join(SEPARATOR);
}

export function renderCV(result: AiResult, profile: Profile): string {
	const cv = result.cv || {};
	const headings = HEADINGS[result.language] || HEADINGS.fr;

	const listItems = (items?: string[]) =>
		(items || [])
			.filter(Boolean)
			.map((item) => `<li>${escapeHtml(item)}</li>`)
			.join('');

	const section = (title: string | undefined, content: string) => (content ? `<h2>${escapeHtml(title)}</h2>${content}` : '');

	// Title on its own line; organisation/place and dates marked up separately so each style can lay them out.
	const metaLine = (organisation: string | undefined, place: string | undefined, dates: string | undefined) => {
		const left = [organisation, place].filter(Boolean).map(escapeHtml).join(SEPARATOR);

		if (!left && !dates) return '';

		const right = dates ? `<span class="when">${escapeHtml(dates)}</span>` : '';
		const middle = left && right ? '<span class="sep sep-when"> · </span>' : '';

		return `<div class="meta"><span class="org">${left}</span>${middle}${right}</div>`;
	};

	const skillsList = cv.skills?.length
		? `<ul>${cv.skills
				.map((skill) => {
					const category = skill.category ? `<b>${escapeHtml(skill.category)} :</b> ` : '';

					return `<li>${category}${(skill.items || []).map(escapeHtml).join(', ')}</li>`;
				})
				.join('')}</ul>`
		: '';

	const experienceList = (cv.experience || [])
		.map(
			(job) =>
				`<div class="job"><h3>${escapeHtml(job.title)}</h3>${metaLine(job.company, job.location, job.dates)}<ul>${listItems(job.bullets)}</ul></div>`
		)
		.join('');

	const educationList = (cv.education || [])
		.map((course) => {
			const details = course.details ? `<div class="details">${escapeHtml(course.details)}</div>` : '';

			return `<div class="job"><h3>${escapeHtml(course.degree)}</h3>${metaLine(course.school, '', course.dates)}${details}</div>`;
		})
		.join('');

	let html = `<div class="cvhead"><h1>${escapeHtml(profile.name || '{{NAME}}')}</h1>`;

	if (cv.headline) html += `<div class="headline">${escapeHtml(cv.headline)}</div>`;

	html += `<div class="contact">${contactLine(profile)}</div></div>`;
	html += section(headings.summary, cv.summary ? `<p>${escapeHtml(cv.summary)}</p>` : '');
	html += section(headings.skills, skillsList);
	html += section(headings.experience, experienceList);
	html += section(headings.education, educationList);
	html += section(headings.languages, cv.languages?.length ? `<p>${cv.languages.map(escapeHtml).join(SEPARATOR)}</p>` : '');

	for (const extraSection of cv.extra_sections || []) {
		html += section(extraSection.heading, `<ul>${listItems(extraSection.items)}</ul>`);
	}

	return fillPlaceholders(html, profile);
}

export function renderLetter(result: AiResult, profile: Profile, today = new Date()): string {
	const headings = HEADINGS[result.language] || HEADINGS.fr;
	const letter = result.cover_letter || {};

	const date = today.toLocaleDateString(headings.locale, { day: 'numeric', month: 'long', year: 'numeric' });
	const placePrefix = result.language === 'fr' && profile.city ? `${escapeHtml(profile.city)}, le ` : '';
	const senderLines = [profile.city, profile.email, profile.phone].filter(Boolean).map(escapeHtml).join('<br>');

	let html = `<div class="lhead"><b>${escapeHtml(profile.name || '')}</b><br>${senderLines}</div>`;

	if (result.company) html += `<div>${escapeHtml(result.company)}</div>`;

	html += `<div class="ldate">${placePrefix}${escapeHtml(date)}</div>`;

	if (letter.subject) html += `<div class="lsubj">${escapeHtml(headings.subject)} : ${escapeHtml(letter.subject)}</div>`;

	html += (letter.body || '')
		.split(/\n\s*\n/)
		.map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
		.join('');

	return fillPlaceholders(html, profile);
}

/** The text the "before tailoring" keyword score is measured on. */
export function sourceText(profile: Profile): string {
	return [profile.experience, profile.skills, profile.languages].join('\n');
}
