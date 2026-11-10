// Shapes exchanged between browser and server, and validation of anything the browser sends.
// Field names match the old Easy Apply backup files so a backup imports as-is.
import type { Keyword, Profile } from './core';
import type { AiResult, Lang } from './render';

export const PROFILE_FIELDS = [
	'name', 'email', 'phone', 'city', 'linkedin', 'github', 'website',
	'experience', 'skills', 'extraSkills', 'languages', 'letters'
] as const satisfies readonly (keyof Profile)[];

export interface Application {
	id: string;
	date: string; // ISO creation time
	ad: string;
	sent: string;
	result: AiResult;
	beforeMatched: string[];
	beforeBullets: { total: number; action: number; quantified: number } | null;
	cvHtml: string;
	letterHtml: string;
}

/** One History row: enough to list it without loading the whole application. */
export interface ApplicationSummary {
	id: string;
	date: string;
	jobTitle: string;
	company: string;
	language: Lang;
	keywordsFound: number;
	keywordsTotal: number;
}

export class Invalid extends Error {}

const LONG = 100_000; // career text, letters, ads, HTML
const SHORT = 500; // names, links

function text(v: unknown, max: number, field: string): string {
	if (v == null) return '';
	if (typeof v !== 'string') throw new Invalid(`${field} must be text`);
	if (v.length > max) throw new Invalid(`${field} is too long`);
	return v;
}

export function toProfile(body: unknown): Required<Profile> {
	if (!body || typeof body !== 'object') throw new Invalid('profile must be an object');
	const b = body as Record<string, unknown>;
	const long = new Set(['experience', 'skills', 'extraSkills', 'languages', 'letters']);
	return Object.fromEntries(PROFILE_FIELDS.map((f) => [f, text(b[f], long.has(f) ? LONG : SHORT, f)])) as Required<Profile>;
}

/** A new application (from a generation or a backup import), minus server-assigned fields. */
export function toNewApplication(body: unknown): Omit<Application, 'id' | 'date'> & { date?: string } {
	if (!body || typeof body !== 'object') throw new Invalid('application must be an object');
	const b = body as Record<string, unknown>;
	const result = b.result as AiResult;
	if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Invalid('result must be an object');
	if (JSON.stringify(result).length > LONG * 2) throw new Invalid('result is too long');
	const language: Lang = result.language === 'en' ? 'en' : 'fr';
	const bb = b.beforeBullets as Application['beforeBullets'];
	const date = typeof b.date === 'string' && !Number.isNaN(Date.parse(b.date)) ? new Date(b.date).toISOString() : undefined;
	return {
		date,
		ad: text(b.ad, LONG, 'ad'),
		sent: text(b.sent, LONG * 2, 'sent'),
		result: { ...result, language },
		beforeMatched: Array.isArray(b.beforeMatched) ? b.beforeMatched.filter((x): x is string => typeof x === 'string').slice(0, 100) : [],
		beforeBullets:
			bb && typeof bb === 'object' && [bb.total, bb.action, bb.quantified].every(Number.isFinite)
				? { total: bb.total, action: bb.action, quantified: bb.quantified }
				: null,
		cvHtml: text(b.cvHtml, LONG, 'cvHtml'),
		letterHtml: text(b.letterHtml, LONG, 'letterHtml')
	};
}

/** Edits made in the preview. */
export function toEdits(body: unknown): { cvHtml?: string; letterHtml?: string } {
	if (!body || typeof body !== 'object') throw new Invalid('edits must be an object');
	const b = body as Record<string, unknown>;
	const out: { cvHtml?: string; letterHtml?: string } = {};
	if ('cvHtml' in b) out.cvHtml = text(b.cvHtml, LONG, 'cvHtml');
	if ('letterHtml' in b) out.letterHtml = text(b.letterHtml, LONG, 'letterHtml');
	if (!Object.keys(out).length) throw new Invalid('nothing to save');
	return out;
}

export type { Keyword };
