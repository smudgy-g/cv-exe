// "Enhance CV": the AI turns keywords and gaps the user really has into skills or bullets under the right job.
// Nothing is saved here: the browser shows the suggestions for review, then saves the profile itself.
import type { Config } from '@sveltejs/adapter-vercel';
import { error, json } from '@sveltejs/kit';
import { parseJSON, redact } from '#lib/core.js';
import { toEnhanceRequest } from '#lib/records.js';
import { AiError, buildEnhancePrompt, complete, DEFAULT_MODEL } from '#lib/server/ai.js';
import { getProfile } from '#lib/server/data.js';
import { parseBody, userId } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

export const config: Config = { maxDuration: 300 };

export const POST: RequestHandler = async (event) => {
	const { items, model } = await parseBody(event, toEnhanceRequest);
	const profile = await getProfile(userId(event));

	if (!profile.experience?.trim()) error(400, 'NO_PROFILE');

	// Redacted line by line, so the AI's line numbers point at the same lines of the real text.
	const lines = profile.experience.split('\n');
	const numberedCareer = lines.map((line, index) => `${index}| ${redact(line, profile).text}`).join('\n');
	const redactedItems = items.map(({ text, note }) => ({ text, note: redact(note, profile).text }));

	let reply: string;

	try {
		reply = await complete(buildEnhancePrompt(numberedCareer, redactedItems), model ?? DEFAULT_MODEL, () => {});
	} catch (aiError) {
		if (aiError instanceof AiError) return json({ message: aiError.code, detail: aiError.message }, { status: 502 });

		throw aiError;
	}

	let parsed: { additions?: unknown; jobs?: unknown };

	try {
		parsed = parseJSON(reply);
	} catch {
		return json({ message: 'BAD_JSON' }, { status: 502 });
	}

	// The model's answer is untrusted: keep only well-formed additions. A bullet must point at a real line;
	// a skill keeps its line (if any) so the user can still turn it into a bullet during review.
	const isLine = (line: unknown): line is number => Number.isInteger(line) && (line as number) >= 0 && (line as number) < lines.length;

	const additions = (Array.isArray(parsed.additions) ? parsed.additions : [])
		.filter(
			(addition) =>
				Number.isInteger(addition?.item) &&
				items[addition.item] &&
				(addition.kind === 'skill' || (addition.kind === 'bullet' && isLine(addition.line))) &&
				typeof addition.text === 'string' &&
				addition.text.trim()
		)
		.map((addition) => {
			const cleanText = addition.text.replace(/^[\s•\-*–·]+/, '').trim();

			return {
				item: items[addition.item].text,
				kind: addition.kind as 'skill' | 'bullet',
				after: isLine(addition.line) ? lines[addition.line] : '',
				text: addition.kind === 'skill' ? cleanText.split('\n')[0].slice(0, 100) : cleanText.slice(0, 300)
			};
		});

	// Every job, for the review's "move to" picker. Labels come from the real (unredacted) lines.
	const jobs = (Array.isArray(parsed.jobs) ? parsed.jobs : [])
		.filter((job) => isLine(job?.start) && isLine(job.end) && job.start <= job.end && lines[job.start].trim())
		.map((job) => ({ label: lines[job.start].trim().slice(0, 120), after: lines[job.end] }));

	return json({ additions, jobs });
};
