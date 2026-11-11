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

const LONG_TEXT_LIMIT = 100_000; // career text, letters, ads, HTML
const SHORT_TEXT_LIMIT = 500; // names, links

function text(value: unknown, maxLength: number, field: string): string {
	if (value == null) return '';

	if (typeof value !== 'string') throw new Invalid(`${field} must be text`);

	if (value.length > maxLength) throw new Invalid(`${field} is too long`);

	return value;
}

export function toProfile(body: unknown): Required<Profile> {
	if (!body || typeof body !== 'object') throw new Invalid('profile must be an object');

	const fields = body as Record<string, unknown>;
	const longFields = new Set(['experience', 'skills', 'extraSkills', 'languages', 'letters']);

	return Object.fromEntries(
		PROFILE_FIELDS.map((field) => [field, text(fields[field], longFields.has(field) ? LONG_TEXT_LIMIT : SHORT_TEXT_LIMIT, field)])
	) as Required<Profile>;
}

/** A new application (from a generation or a backup import), minus server-assigned fields. */
export function toNewApplication(body: unknown): Omit<Application, 'id' | 'date'> & { date?: string } {
	if (!body || typeof body !== 'object') throw new Invalid('application must be an object');

	const fields = body as Record<string, unknown>;
	const result = fields.result as AiResult;

	if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Invalid('result must be an object');

	if (JSON.stringify(result).length > LONG_TEXT_LIMIT * 2) throw new Invalid('result is too long');

	const language: Lang = result.language === 'en' ? 'en' : 'fr';
	const beforeBullets = fields.beforeBullets as Application['beforeBullets'];

	const date =
		typeof fields.date === 'string' && !Number.isNaN(Date.parse(fields.date)) ? new Date(fields.date).toISOString() : undefined;

	const beforeMatched = Array.isArray(fields.beforeMatched)
		? fields.beforeMatched.filter((term): term is string => typeof term === 'string').slice(0, 100)
		: [];

	const validBeforeBullets =
		beforeBullets &&
		typeof beforeBullets === 'object' &&
		[beforeBullets.total, beforeBullets.action, beforeBullets.quantified].every(Number.isFinite);

	return {
		date,
		ad: text(fields.ad, LONG_TEXT_LIMIT, 'ad'),
		sent: text(fields.sent, LONG_TEXT_LIMIT * 2, 'sent'),
		result: { ...result, language },
		beforeMatched,
		beforeBullets: validBeforeBullets
			? { total: beforeBullets.total, action: beforeBullets.action, quantified: beforeBullets.quantified }
			: null,
		cvHtml: text(fields.cvHtml, LONG_TEXT_LIMIT, 'cvHtml'),
		letterHtml: text(fields.letterHtml, LONG_TEXT_LIMIT, 'letterHtml')
	};
}

/** Edits made in the preview. */
export function toEdits(body: unknown): { cvHtml?: string; letterHtml?: string } {
	if (!body || typeof body !== 'object') throw new Invalid('edits must be an object');

	const fields = body as Record<string, unknown>;
	const edits: { cvHtml?: string; letterHtml?: string } = {};

	if ('cvHtml' in fields) edits.cvHtml = text(fields.cvHtml, LONG_TEXT_LIMIT, 'cvHtml');

	if ('letterHtml' in fields) edits.letterHtml = text(fields.letterHtml, LONG_TEXT_LIMIT, 'letterHtml');

	if (!Object.keys(edits).length) throw new Invalid('nothing to save');

	return edits;
}

export type { Keyword };
