// The prompt and the OpenRouter call. Only redacted text is ever passed to complete().
import { OPENROUTER_API_KEY } from '$app/env/private';
import type { Profile } from '#lib/core.js';

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';

const SCHEMA = `{
  "language": "fr" or "en",
  "job_title": "job title from the ad",
  "company": "company name from the ad, or empty string",
  "keywords": [{ "term": "one of the 10-20 most important ATS keywords/phrases from the ad (hard skills, tools, methods, qualifications, domain terms), 1-4 words, spelled exactly as in the ad", "variants": ["the same concept in BOTH English and French, plus common alternative spellings and word forms, e.g. term 'qualité du code' -> ['code quality', 'clean code', 'quality code']; 'VueJS' -> ['Vue.js', 'Vue']; 'tests' -> ['testing', 'test', 'tests unitaires', 'unit tests']. Only true equivalents, never broader or merely related terms"] }],
  "changes": ["every meaningful edit you made to the CV, one short line each"],
  "gaps": ["requirements of the ad the candidate's material does not evidence"],
  "cv": {
    "headline": "target job title line under the name",
    "summary": "3-4 line professional summary tailored to the ad",
    "skills": [{ "category": "", "items": [""] }],
    "experience": [{ "title": "", "company": "", "location": "", "dates": "", "bullets": [""] }],
    "education": [{ "degree": "", "school": "", "dates": "", "details": "" }],
    "languages": ["Language (level)"],
    "extra_sections": [{ "heading": "", "items": [""] }]
  },
  "cover_letter": { "subject": "subject line", "body": "full letter body, paragraphs separated by a blank line, from salutation to sign-off, signed {{NAME}}" }
}`;

export function buildPrompt(material: string, lang: 'auto' | 'fr' | 'en'): string {
	const language = lang === 'fr' ? 'French' : lang === 'en' ? 'English' : 'the same language as the job ad (French or English)';
	return `You are an expert CV writer and ATS optimisation specialist helping a candidate apply for a job. Produce a tailored CV and a cover letter.

HARD RULES
- Never invent experience, employers, dates, numbers, qualifications or achievements. Only use facts present in the candidate material.
- Skills may come ONLY from "CV SKILLS", "ADDITIONAL SKILLS", or skills clearly evidenced in the experience. Never add any other skill.
- Any change that uses an item from ADDITIONAL SKILLS must be listed in "changes" starting with "★ ".
- If the ad requires something the material does not evidence, do NOT claim it: list it in "gaps".
- Personal details were replaced by placeholders ({{NAME}}, {{EMAIL}}, {{PHONE}}, {{LINKEDIN}}, {{GITHUB}}, {{WEBSITE}}). Never invent contact details and do not put them in the CV; sign the letter with {{NAME}}.

HOW TO TAILOR
- Reorder, rephrase, emphasise and trim so the most relevant experience and skills come first. Drop clearly irrelevant detail. Aim for one page (two max for long careers).
- Start EVERY bullet with a strong, specific action verb (e.g. Built, Led, Designed, Cut, Launched / Conçu, Piloté, Développé, Réduit, Lancé). Never open with weak phrases such as "Responsible for", "Worked on", "Helped", "Participated in", "Chargé de", "Participation à", "J'ai". Vary the verbs.
- Each bullet: what you did + how + the result. Keep any number from the material (amounts, %, counts, growth); never invent one. One to two lines per bullet (max ~200 characters).
- Skills section: group skills into a few clear categories, most relevant to the ad first.
- Where the candidate genuinely has something the ad asks for, use the ad's exact wording so ATS keyword matching succeeds.
- Use standard, plain content (no tables, emojis or symbols in the CV).
- Write the CV and the cover letter in ${language}. "language" must say which one you used.
- Cover letter: 250-350 words, specific to this company and role, in the tone and voice of the past cover letters. No clichés ("I am writing to express my interest", "je me permets de"). In French, follow lettre de motivation conventions (e.g. "Madame, Monsieur," and a formule de politesse).

Reply with ONLY a JSON object, no markdown fences, matching:
${SCHEMA}

${material}`;
}

export function buildMaterial(p: Profile, ad: string, notes: string): string {
	return `============ CANDIDATE EXPERIENCE & EDUCATION ============
${p.experience}

============ CV SKILLS ============
${p.skills || 'None'}

============ ADDITIONAL SKILLS (candidate has these; not yet on the CV) ============
${p.extraSkills || 'None'}

============ LANGUAGES ============
${p.languages || 'None'}

============ PAST COVER LETTERS (tone and voice reference only) ============
${p.letters || 'None'}

============ JOB AD ============
${ad}

============ CANDIDATE NOTES ============
${notes || 'None'}`;
}

/** Thrown with a code the browser translates: TRUNCATED, BAD_JSON, AI_ERROR (+ the provider's message). */
export class AiError extends Error {
	constructor(
		public code: 'TRUNCATED' | 'BAD_JSON' | 'AI_ERROR',
		message = code
	) {
		super(message);
	}
}

/**
 * Splits an OpenRouter server-sent-events body into events. Keeps the unfinished tail for the next chunk.
 * Pure, so it is unit tested.
 */
export function parseSSE(buffer: string): { events: any[]; rest: string } {
	const lines = buffer.split('\n');
	const rest = lines.pop() ?? '';
	const events = [];
	for (const line of lines) {
		if (!line.startsWith('data: ')) continue; // ": OPENROUTER PROCESSING" keep-alives and blank lines
		const data = line.slice(6).trim();
		if (data === '[DONE]') continue;
		try {
			events.push(JSON.parse(data));
		} catch {
			/* partial or malformed line: ignore */
		}
	}
	return { events, rest };
}

/** Streams the model's answer; onProgress gets the number of characters produced so far (thinking included). */
export async function complete(prompt: string, model: string, onProgress: (chars: number) => void): Promise<string> {
	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'CV.exe' },
		body: JSON.stringify({
			model,
			temperature: 0.4,
			max_tokens: 16000, // includes hidden reasoning; only tokens used are billed
			stream: true,
			messages: [{ role: 'user', content: prompt }]
		})
	});
	if (!res.ok || !res.body) {
		const data = await res.json().catch(() => ({}));
		throw new AiError('AI_ERROR', data.error?.message || `OpenRouter HTTP ${res.status}`);
	}

	let content = '',
		produced = 0,
		finish: string | null = null,
		buffer = '';
	const decoder = new TextDecoder();
	for await (const chunk of res.body) {
		const { events, rest } = parseSSE(buffer + decoder.decode(chunk, { stream: true }));
		buffer = rest;
		for (const ev of events) {
			if (ev.error) throw new AiError('AI_ERROR', ev.error.message || 'AI error');
			const choice = ev.choices?.[0];
			const piece = choice?.delta?.content || '';
			content += piece;
			produced += piece.length + (choice?.delta?.reasoning?.length || 0);
			finish = choice?.finish_reason || finish;
		}
		onProgress(produced);
	}
	if (finish === 'length') throw new AiError('TRUNCATED');
	return content;
}
