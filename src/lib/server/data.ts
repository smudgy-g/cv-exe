// Every query is scoped to the signed-in user's id: one user can never read or change another's rows.
import { coverage, type Profile } from '#lib/core.js';
import type { Application, ApplicationSummary } from '#lib/records.js';
import { sql } from './db.js';

export async function getProfile(userId: string): Promise<Profile> {
	const [r] = await sql`select * from profiles where user_id = ${userId}`;
	if (!r) return {};
	return {
		name: r.name, email: r.email, phone: r.phone, city: r.city, linkedin: r.linkedin, github: r.github, website: r.website,
		experience: r.experience, skills: r.skills, extraSkills: r.extra_skills, languages: r.languages, letters: r.letters
	};
}

export async function saveProfile(userId: string, p: Required<Profile>): Promise<void> {
	await sql`
		insert into profiles (user_id, name, email, phone, city, linkedin, github, website, experience, skills, extra_skills, languages, letters)
		values (${userId}, ${p.name}, ${p.email}, ${p.phone}, ${p.city}, ${p.linkedin}, ${p.github}, ${p.website},
		        ${p.experience}, ${p.skills}, ${p.extraSkills}, ${p.languages}, ${p.letters})
		on conflict (user_id) do update set
			name = excluded.name, email = excluded.email, phone = excluded.phone, city = excluded.city,
			linkedin = excluded.linkedin, github = excluded.github, website = excluded.website,
			experience = excluded.experience, skills = excluded.skills, extra_skills = excluded.extra_skills,
			languages = excluded.languages, letters = excluded.letters, updated_at = now()`;
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, ' ');

export async function listApplications(userId: string): Promise<ApplicationSummary[]> {
	const rows = await sql`
		select id, created_at, job_title, company, language, result->'keywords' as keywords, cv_html
		from applications where user_id = ${userId} order by created_at desc`;
	// ponytail: scores computed per request from the CV text; store them in columns if History ever gets slow.
	return rows.map((r) => ({
		id: r.id,
		date: new Date(r.created_at).toISOString(),
		jobTitle: r.job_title,
		company: r.company,
		language: r.language,
		keywordsFound: coverage(r.keywords || [], stripTags(r.cv_html)).matched.length,
		keywordsTotal: (r.keywords || []).length
	}));
}

const toApplication = (r: Record<string, any>): Application => ({
	id: r.id,
	date: new Date(r.created_at).toISOString(),
	ad: r.job_ad,
	sent: r.sent_to_ai,
	result: r.result,
	beforeMatched: r.before_keywords,
	beforeBullets: r.before_bullets,
	cvHtml: r.cv_html,
	letterHtml: r.letter_html
});

export async function getApplication(userId: string, id: string): Promise<Application | null> {
	const [r] = await sql`select * from applications where id = ${id} and user_id = ${userId}`;
	return r ? toApplication(r) : null;
}

export async function createApplication(userId: string, a: Omit<Application, 'id' | 'date'> & { date?: string }): Promise<Application> {
	const [r] = await sql`
		insert into applications (user_id, job_title, company, language, job_ad, sent_to_ai, result, before_keywords, before_bullets, cv_html, letter_html, created_at)
		values (${userId}, ${a.result.job_title || ''}, ${a.result.company || ''}, ${a.result.language}, ${a.ad}, ${a.sent},
		        ${JSON.stringify(a.result)}, ${JSON.stringify(a.beforeMatched)}, ${a.beforeBullets && JSON.stringify(a.beforeBullets)},
		        ${a.cvHtml}, ${a.letterHtml}, ${a.date ?? new Date().toISOString()})
		returning *`;
	return toApplication(r);
}

/** Returns false if the application doesn't exist or isn't this user's. */
export async function updateApplication(userId: string, id: string, e: { cvHtml?: string; letterHtml?: string }): Promise<boolean> {
	const rows = await sql`
		update applications set
			cv_html = coalesce(${e.cvHtml ?? null}, cv_html),
			letter_html = coalesce(${e.letterHtml ?? null}, letter_html),
			updated_at = now()
		where id = ${id} and user_id = ${userId} returning id`;
	return rows.length === 1;
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
	const rows = await sql`delete from applications where id = ${id} and user_id = ${userId} returning id`;
	return rows.length === 1;
}

export async function listFullApplications(userId: string): Promise<Application[]> {
	const rows = await sql`select * from applications where user_id = ${userId} order by created_at desc`;
	return rows.map(toApplication);
}

/** Used only by "Import a backup", which replaces the whole history after the user confirms. */
export async function deleteAllApplications(userId: string): Promise<void> {
	await sql`delete from applications where user_id = ${userId}`;
}
