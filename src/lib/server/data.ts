// Every query is scoped to the signed-in user's id: one user can never read or change another's rows.
import { coverage, type Profile } from '#lib/core.js';
import type { Application, ApplicationSummary } from '#lib/records.js';
import { sql } from './db.js';

export async function getProfile(userId: string): Promise<Profile> {
	const [row] = await sql`select * from profiles where user_id = ${userId}`;

	if (!row) return {};

	return {
		name: row.name,
		email: row.email,
		phone: row.phone,
		city: row.city,
		linkedin: row.linkedin,
		github: row.github,
		website: row.website,
		experience: row.experience,
		skills: row.skills,
		extraSkills: row.extra_skills,
		languages: row.languages,
		letters: row.letters
	};
}

export async function saveProfile(userId: string, profile: Required<Profile>): Promise<void> {
	await sql`
		insert into profiles (user_id, name, email, phone, city, linkedin, github, website, experience, skills, extra_skills, languages, letters)
		values (${userId}, ${profile.name}, ${profile.email}, ${profile.phone}, ${profile.city}, ${profile.linkedin}, ${profile.github}, ${profile.website},
		        ${profile.experience}, ${profile.skills}, ${profile.extraSkills}, ${profile.languages}, ${profile.letters})
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
	return rows.map((row) => ({
		id: row.id,
		date: new Date(row.created_at).toISOString(),
		jobTitle: row.job_title,
		company: row.company,
		language: row.language,
		keywordsFound: coverage(row.keywords || [], stripTags(row.cv_html)).matched.length,
		keywordsTotal: (row.keywords || []).length
	}));
}

const toApplication = (row: Record<string, any>): Application => ({
	id: row.id,
	date: new Date(row.created_at).toISOString(),
	ad: row.job_ad,
	sent: row.sent_to_ai,
	result: row.result,
	beforeMatched: row.before_keywords,
	beforeBullets: row.before_bullets,
	cvHtml: row.cv_html,
	letterHtml: row.letter_html
});

export async function getApplication(userId: string, id: string): Promise<Application | null> {
	const [row] = await sql`select * from applications where id = ${id} and user_id = ${userId}`;

	return row ? toApplication(row) : null;
}

export async function createApplication(
	userId: string,
	application: Omit<Application, 'id' | 'date'> & { date?: string }
): Promise<Application> {
	const { result } = application;

	const [row] = await sql`
		insert into applications (user_id, job_title, company, language, job_ad, sent_to_ai, result, before_keywords, before_bullets, cv_html, letter_html, created_at)
		values (${userId}, ${result.job_title || ''}, ${result.company || ''}, ${result.language}, ${application.ad}, ${application.sent},
		        ${JSON.stringify(result)}, ${JSON.stringify(application.beforeMatched)}, ${application.beforeBullets && JSON.stringify(application.beforeBullets)},
		        ${application.cvHtml}, ${application.letterHtml}, ${application.date ?? new Date().toISOString()})
		returning *`;

	return toApplication(row);
}

/** Returns false if the application doesn't exist or isn't this user's. */
export async function updateApplication(
	userId: string,
	id: string,
	edits: { cvHtml?: string; letterHtml?: string }
): Promise<boolean> {
	const rows = await sql`
		update applications set
			cv_html = coalesce(${edits.cvHtml ?? null}, cv_html),
			letter_html = coalesce(${edits.letterHtml ?? null}, letter_html),
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
