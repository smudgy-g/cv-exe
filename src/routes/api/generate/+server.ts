// Generate a tailored CV + letter. Streams newline-delimited JSON:
//   {"type":"progress","chars":1234}   while the model writes
//   {"type":"done","app":{...}}        the saved application
//   {"type":"error","code":"...","message":"..."}
import type { Config } from '@sveltejs/adapter-vercel';
import { error } from '@sveltejs/kit';
import { bulletStats, coverage, keywordTerm, parseJSON, redact, sourceBullets } from '#lib/core.js';
import { renderCV, renderLetter, sourceText, type AiResult } from '#lib/render.js';
import { Invalid } from '#lib/records.js';
import { AiError, buildMaterial, buildPrompt, complete, DEFAULT_MODEL } from '#lib/server/ai.js';
import { createApplication, getProfile } from '#lib/server/data.js';
import { parseBody, userId } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

export const config: Config = { maxDuration: 300 }; // generations take 30-90 s

function toRequest(body: unknown) {
	const fields = (body ?? {}) as Record<string, unknown>;
	const ad = typeof fields.ad === 'string' ? fields.ad.trim() : '';

	if (ad.length < 100) throw new Invalid('AD_SHORT');

	if (ad.length > 50_000) throw new Invalid('ad is too long');

	const notes = typeof fields.notes === 'string' ? fields.notes.trim().slice(0, 2000) : '';
	const lang = fields.lang === 'fr' || fields.lang === 'en' ? fields.lang : 'auto';
	const model = typeof fields.model === 'string' && /^[\w.-]+\/[\w.:-]+$/.test(fields.model) ? fields.model : DEFAULT_MODEL;

	return { ad, notes, lang, model } as const;
}

export const POST: RequestHandler = async (event) => {
	const currentUserId = userId(event);
	const { ad, notes, lang, model } = await parseBody(event, toRequest);
	const profile = await getProfile(currentUserId);

	if (!profile.experience?.trim()) error(400, 'NO_PROFILE');

	// Personal details are replaced by placeholders here, before anything leaves for the AI.
	const sent = redact(buildMaterial(profile, ad, notes), profile).text;

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (message: object) => controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));

			try {
				let lastReported = 0;

				const reply = await complete(buildPrompt(sent, lang), model, (characters) => {
					if (characters - lastReported >= 400) {
						lastReported = characters;
						send({ type: 'progress', chars: characters });
					}
				});

				let result: AiResult;

				try {
					result = parseJSON(reply);
				} catch {
					throw new AiError('BAD_JSON');
				}

				if (result.language !== 'fr' && result.language !== 'en') result.language = lang === 'en' ? 'en' : 'fr';

				const application = await createApplication(currentUserId, {
					ad,
					sent,
					result,
					beforeMatched: coverage(result.keywords, sourceText(profile)).matched.map(keywordTerm),
					beforeBullets: bulletStats(sourceBullets(profile.experience)),
					cvHtml: renderCV(result, profile),
					letterHtml: renderLetter(result, profile)
				});

				send({ type: 'done', app: application });
			} catch (generationError) {
				const isAiError = generationError instanceof AiError;

				if (!isAiError) console.error('generate failed', generationError);

				send({
					type: 'error',
					code: isAiError ? generationError.code : 'SERVER',
					message: isAiError ? generationError.message : 'Server error'
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
};
