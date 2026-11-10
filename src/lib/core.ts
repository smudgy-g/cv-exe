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
export function norm(s: string | null | undefined): string {
	return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function escRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function esc(s: unknown): string {
	const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	return String(s ?? '').replace(/[&<>"']/g, (c) => map[c]);
}

/** Replace personal details with placeholders before anything leaves for the AI. */
export function redact(input: string, p: Profile): { text: string; hits: number } {
	let text = input;
	let hits = 0;
	const rep = (re: RegExp, ph: string) => {
		text = text.replace(re, () => {
			hits++;
			return ph;
		});
	};
	const W = '(?<![\\p{L}\\p{N}])',
		E = '(?![\\p{L}\\p{N}])';

	if (p.email?.trim()) rep(new RegExp(escRe(p.email.trim()), 'gi'), '{{EMAIL}}');
	rep(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '{{EMAIL}}');
	rep(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/\S+/gi, '{{LINKEDIN}}');
	rep(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+(?:\/[\w.-]+)*\/?/gi, '{{GITHUB}}');

	// The user's own links, however they were typed (with or without https:// and www.)
	for (const [key, ph] of [
		['linkedin', 'LINKEDIN'],
		['github', 'GITHUB'],
		['website', 'WEBSITE']
	] as const) {
		const link = (p[key] || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
		if (link.length >= 6) rep(new RegExp('(?:https?://)?(?:www\\.)?' + escRe(link) + '/?', 'gi'), `{{${ph}}}`);
	}

	const digits = (p.phone || '').replace(/\D/g, '');
	if (digits.length >= 6) {
		const tail = digits.slice(-9).split('').join('[\\s.\\-]?');
		rep(new RegExp('(?:\\+?\\d{1,4}[\\s.\\-]?)?(?:\\(0\\)[\\s.\\-]?)?' + tail, 'g'), '{{PHONE}}');
	}
	rep(/(?:\+33[\s.-]?(?:\(0\)[\s.-]?)?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, '{{PHONE}}');
	rep(/\+\d{1,3}(?:[\s.-]?\d){8,12}/g, '{{PHONE}}');

	const name = (p.name || '').trim();
	if (name) {
		// accent-insensitive: "Édwige" also catches "Edwige", "EDWIGE"
		const VAR: Record<string, string> = {
			a: 'aàâäáãå',
			e: 'eéèêë',
			i: 'iîïíì',
			o: 'oôöóòõ',
			u: 'uùûüú',
			c: 'cç',
			n: 'nñ',
			y: 'yÿ'
		};
		const pat = (s: string) =>
			[...norm(s)].map((ch) => (VAR[ch] ? `[${VAR[ch]}]` : ch === ' ' ? '[\\s-]+' : escRe(ch))).join('');
		rep(new RegExp(W + pat(name) + E, 'giu'), '{{NAME}}');
		for (const part of name.split(/[\s-]+/)) if (part.length >= 3) rep(new RegExp(W + pat(part) + E, 'giu'), '{{NAME}}');
	}
	return { text, hits };
}

/** Put personal details back in, on our side only. Input is already-escaped HTML. */
export function fill(html: string, p: Profile): string {
	return html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (PLACEHOLDERS[k] ? esc(p[PLACEHOLDERS[k]] || '') : m));
}

export function kwTerm(k: Keyword): string {
	return typeof k === 'string' ? k : k.term;
}

/** Which ad keywords appear in a text, as whole words/phrases, in any of their forms. */
export function coverage<K extends Keyword>(keywords: K[] | undefined, text: string): { matched: K[]; missing: K[] } {
	const t = norm(text);
	const has = (v: string) => new RegExp('(?<![\\p{L}\\p{N}])' + escRe(v) + '(?![\\p{L}\\p{N}])', 'u').test(t);
	const matched: K[] = [],
		missing: K[] = [];
	for (const k of keywords || []) {
		const forms = (typeof k === 'string' ? [k] : [k.term, ...(k.variants || [])]).map((v) => norm(v).trim()).filter(Boolean);
		(forms.some(has) ? matched : missing).push(k);
	}
	return { matched, missing };
}

/** The JSON object in a model reply, ignoring any text or code fences around it. */
export function parseJSON(s: string): any {
	const a = s.indexOf('{'),
		b = s.lastIndexOf('}');
	if (a < 0 || b < a) throw new Error('BAD_JSON');
	return JSON.parse(s.slice(a, b + 1));
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
	return (text || '').split('\n').filter((l) => /^\s*[•\-*–·]/.test(l));
}

export function bulletStats(bullets: string[]): { total: number; action: number; quantified: number } {
	const b = bullets.map((x) => norm(x).replace(/^[\s•\-*–·]+/, '')).filter((x) => x.length > 3);
	return {
		total: b.length,
		action: b.filter((x) => !WEAK_OPENERS.some((w) => x.startsWith(w))).length,
		quantified: b.filter((x) => /\d|%|€|\$|£/.test(x)).length
	};
}
