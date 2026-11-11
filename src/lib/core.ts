// Pure logic, no DOM or server: redaction of personal details, placeholders, keyword coverage, bullet quality.
// Shared by the browser and the server. Tested in core.test.ts.

/** The candidate's profile. Field names match the old Easy Apply backup files. */
export interface Profile {
	name?: string;
	email?: string;
	phone?: string;
	city?: string;
	linkedin?: string;
	github?: string;
	website?: string;
	experience?: string;
	skills?: string;
	extraSkills?: string;
	languages?: string;
	letters?: string;
}

/** "term" (very old history) or a term with its equivalents in English/French and other spellings. */
export type Keyword = string | { term: string; variants?: string[] };

const PLACEHOLDERS: Record<string, keyof Profile> = {
	NAME: 'name',
	EMAIL: 'email',
	PHONE: 'phone',
	LINKEDIN: 'linkedin',
	GITHUB: 'github',
	WEBSITE: 'website',
	CITY: 'city'
};

/** Lowercase, accents removed: "Équipe" → "equipe". */
export function normalizeText(text: string | null | undefined): string {
	return (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(value: unknown): string {
	const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

/** Replace personal details with placeholders before anything leaves for the AI. */
export function redact(input: string, profile: Profile): { text: string; hits: number } {
	let text = input;
	let hits = 0;

	const replaceAll = (pattern: RegExp, placeholder: string) => {
		text = text.replace(pattern, () => {
			hits++;
			return placeholder;
		});
	};

	const WORD_START = '(?<![\\p{L}\\p{N}])';
	const WORD_END = '(?![\\p{L}\\p{N}])';

	if (profile.email?.trim()) replaceAll(new RegExp(escapeRegExp(profile.email.trim()), 'gi'), '{{EMAIL}}');

	replaceAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '{{EMAIL}}');
	replaceAll(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/\S+/gi, '{{LINKEDIN}}');
	replaceAll(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+(?:\/[\w.-]+)*\/?/gi, '{{GITHUB}}');

	// The user's own links, however they were typed (with or without https:// and www.)
	for (const [field, placeholder] of [
		['linkedin', 'LINKEDIN'],
		['github', 'GITHUB'],
		['website', 'WEBSITE']
	] as const) {
		const link = (profile[field] || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

		if (link.length >= 6) replaceAll(new RegExp('(?:https?://)?(?:www\\.)?' + escapeRegExp(link) + '/?', 'gi'), `{{${placeholder}}}`);
	}

	const phoneDigits = (profile.phone || '').replace(/\D/g, '');

	if (phoneDigits.length >= 6) {
		const lastDigitsPattern = phoneDigits.slice(-9).split('').join('[\\s.\\-]?');

		replaceAll(new RegExp('(?:\\+?\\d{1,4}[\\s.\\-]?)?(?:\\(0\\)[\\s.\\-]?)?' + lastDigitsPattern, 'g'), '{{PHONE}}');
	}

	replaceAll(/(?:\+33[\s.-]?(?:\(0\)[\s.-]?)?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, '{{PHONE}}');
	replaceAll(/\+\d{1,3}(?:[\s.-]?\d){8,12}/g, '{{PHONE}}');

	const name = (profile.name || '').trim();

	if (name) {
		// accent-insensitive: "Édwige" also catches "Edwige", "EDWIGE"
		const ACCENTED_FORMS: Record<string, string> = {
			a: 'aàâäáãå',
			e: 'eéèêë',
			i: 'iîïíì',
			o: 'oôöóòõ',
			u: 'uùûüú',
			c: 'cç',
			n: 'nñ',
			y: 'yÿ'
		};

		const accentInsensitivePattern = (text: string) =>
			[...normalizeText(text)]
				.map((character) =>
					ACCENTED_FORMS[character] ? `[${ACCENTED_FORMS[character]}]` : character === ' ' ? '[\\s-]+' : escapeRegExp(character)
				)
				.join('');

		replaceAll(new RegExp(WORD_START + accentInsensitivePattern(name) + WORD_END, 'giu'), '{{NAME}}');

		for (const namePart of name.split(/[\s-]+/)) {
			if (namePart.length >= 3) replaceAll(new RegExp(WORD_START + accentInsensitivePattern(namePart) + WORD_END, 'giu'), '{{NAME}}');
		}
	}

	return { text, hits };
}

/** Put personal details back in, on our side only. Input is already-escaped HTML. */
export function fillPlaceholders(html: string, profile: Profile): string {
	return html.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
		PLACEHOLDERS[key] ? escapeHtml(profile[PLACEHOLDERS[key]] || '') : placeholder
	);
}

export function keywordTerm(keyword: Keyword): string {
	return typeof keyword === 'string' ? keyword : keyword.term;
}

/** Which ad keywords appear in a text, as whole words/phrases, in any of their forms. */
export function coverage<K extends Keyword>(keywords: K[] | undefined, text: string): { matched: K[]; missing: K[] } {
	const normalizedText = normalizeText(text);

	const containsWord = (form: string) =>
		new RegExp('(?<![\\p{L}\\p{N}])' + escapeRegExp(form) + '(?![\\p{L}\\p{N}])', 'u').test(normalizedText);

	const matched: K[] = [];
	const missing: K[] = [];

	for (const keyword of keywords || []) {
		const forms = (typeof keyword === 'string' ? [keyword] : [keyword.term, ...(keyword.variants || [])])
			.map((form) => normalizeText(form).trim())
			.filter(Boolean);

		(forms.some(containsWord) ? matched : missing).push(keyword);
	}

	return { matched, missing };
}

/** The JSON object in a model reply, ignoring any text or code fences around it. */
export function parseJSON(reply: string): any {
	const start = reply.indexOf('{');
	const end = reply.lastIndexOf('}');

	if (start < 0 || end < start) throw new Error('BAD_JSON');

	return JSON.parse(reply.slice(start, end + 1));
}

// Bullet quality, measured the same way before and after tailoring.
const WEAK_OPENERS = [
	'responsible for', 'responsibilities', 'worked on', 'working on', 'helped', 'assisted', 'participated',
	'involved in', 'duties included', 'tasked with', 'in charge of', 'i ', 'my ', 'was ', 'were ',
	'responsable de', 'responsable du', 'en charge', 'charge de', 'chargee de', 'participation', 'participe',
	'aide a', "j'ai", 'j’ai', 'je ', 'mon ', 'ma ', 'mes ', 'travail sur', 'implique'
];

/** Lines of a career text that are bullets (start with •, -, *, – or ·). */
export function sourceBullets(text: string | undefined): string[] {
	return (text || '').split('\n').filter((line) => /^\s*[•\-*–·]/.test(line));
}

export function bulletStats(bullets: string[]): { total: number; action: number; quantified: number } {
	const cleanBullets = bullets
		.map((bullet) => normalizeText(bullet).replace(/^[\s•\-*–·]+/, ''))
		.filter((bullet) => bullet.length > 3);

	return {
		total: cleanBullets.length,
		action: cleanBullets.filter((bullet) => !WEAK_OPENERS.some((opener) => bullet.startsWith(opener))).length,
		quantified: cleanBullets.filter((bullet) => /\d|%|€|\$|£/.test(bullet)).length
	};
}
