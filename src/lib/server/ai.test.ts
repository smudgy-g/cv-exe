import { describe, expect, it, vi } from 'vitest';
vi.mock('$app/env/private', () => ({ OPENROUTER_API_KEY: 'test' }));
const { parseSSE, buildPrompt } = await import('./ai');

describe('parseSSE', () => {
	it('reads complete events, skips keep-alives and [DONE], keeps the partial tail', () => {
		const { events, rest } = parseSSE(': OPENROUTER PROCESSING\n\ndata: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: [DONE]\ndata: {"choices":[{"del');
		expect(events).toEqual([{ choices: [{ delta: { content: 'Hel' } }] }]);
		expect(rest).toBe('data: {"choices":[{"del');
	});
	it('completes an event across chunks', () => {
		const first = parseSSE('data: {"a":');
		const second = parseSSE(first.rest + '1}\n');
		expect(second.events).toEqual([{ a: 1 }]);
	});
});

describe('buildPrompt', () => {
	it('asks for the chosen language and lists every placeholder', () => {
		const p = buildPrompt('MATERIAL', 'fr');
		expect(p).toContain('Write the CV and the cover letter in French');
		expect(p).toContain('{{GITHUB}}, {{WEBSITE}}');
		expect(p.endsWith('MATERIAL')).toBe(true);
	});
});
