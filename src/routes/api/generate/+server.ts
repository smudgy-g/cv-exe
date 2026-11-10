// Generate a tailored CV + letter. Streams newline-delimited JSON:
//   {"type":"progress","chars":1234}   while the model writes
//   {"type":"done","app":{...}}        the saved application
//   {"type":"error","code":"...","message":"..."}
import type { Config } from '@sveltejs/adapter-vercel';
import { error } from '@sveltejs/kit';
import { bulletStats, coverage, kwTerm, parseJSON, redact, sourceBullets } from '#lib/core.js';
import { renderCV, renderLetter, sourceText, type AiResult } from '#lib/render.js';
import { Invalid } from '#lib/records.js';
import { AiError, buildMaterial, buildPrompt, complete, DEFAULT_MODEL } from '#lib/server/ai.js';
import { createApplication, getProfile } from '#lib/server/data.js';
import { body, userId } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

export const config: Config = { maxDuration: 300 }; // generations take 30-90 s

function toRequest(b: unknown) {
	const r = (b ?? {}) as Record<string, unknown>;
	const ad = typeof r.ad === 'string' ? r.ad.trim() : '';
	if (ad.length < 100) throw new Invalid('AD_SHORT');
	if (ad.length > 50_000) throw new Invalid('ad is too long');
	const notes = typeof r.notes === 'string' ? r.notes.trim().slice(0, 2000) : '';
	const lang = r.lang === 'fr' || r.lang === 'en' ? r.lang : 'auto';
	const model = typeof r.model === 'string' && /^[\w.-]+\/[\w.:-]+$/.test(r.model) ? r.model : DEFAULT_MODEL;
	return { ad, notes, lang, model } as const;
}

export const POST: RequestHandler = async (event) => {
	const uid = userId(event);
	const { ad, notes, lang, model } = await body(event, toRequest);
	const profile = await getProfile(uid);
	if (!profile.experience?.trim()) error(400, 'NO_PROFILE');

	// Personal details are replaced by placeholders here, before anything leaves for the AI.
	const sent = redact(buildMaterial(profile, ad, notes), profile).text;

	const enc = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
			try {
				let last = 0;
				const raw = await complete(buildPrompt(sent, lang), model, (chars) => {
					if (chars - last >= 400) send({ type: 'progress', chars: (last = chars) });
				});
				let result: AiResult;
				try {
					result = parseJSON(raw);
				} catch {
					throw new AiError('BAD_JSON');
				}
				if (result.language !== 'fr' && result.language !== 'en') result.language = lang === 'en' ? 'en' : 'fr';
				const app = await createApplication(uid, {
					ad,
					sent,
					result,
					beforeMatched: coverage(result.keywords, sourceText(profile)).matched.map(kwTerm),
					beforeBullets: bulletStats(sourceBullets(profile.experience)),
					cvHtml: renderCV(result, profile),
					letterHtml: renderLetter(result, profile)
				});
				send({ type: 'done', app });
			} catch (e) {
				const code = e instanceof AiError ? e.code : 'SERVER';
				if (code === 'SERVER') console.error('generate failed', e);
				send({ type: 'error', code, message: e instanceof AiError ? e.message : 'Server error' });
			} finally {
				controller.close();
			}
		}
	});
	return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
};
