// Browser-side helpers for talking to our API.
import { t } from './i18n.svelte';

/** Turns an error code from the server into a sentence in the page language. */
export function errorText(code: string, message = ''): string {
	switch (code) {
		case 'NO_PROFILE': return t('err.profile');
		case 'AD_SHORT': return t('err.ad');
		case 'TRUNCATED': return t('err.truncated');
		case 'BAD_JSON': return t('err.json');
		case 'AI_ERROR': return t('err.ai', message);
		case 'NET': return t('err.net');
		default: return t('err.server');
	}
}

/** Calls callback() once `delayMs` have passed without another trigger; returns the trigger function. */
export function debounce(callback: () => void, delayMs: number) {
	let timer: ReturnType<typeof setTimeout>;

	return () => {
		clearTimeout(timer);
		timer = setTimeout(callback, delayMs);
	};
}

/** Per-device setting: document style for the CV/letter preview and PDF. */
export const THEMES = ['classic', 'band', 'bold'] as const;
export type Theme = (typeof THEMES)[number];

export const themeSetting = {
	get: (): Theme => {
		const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem('cvexe.theme');

		return THEMES.includes(stored as Theme) ? (stored as Theme) : 'classic';
	},
	set: (theme: Theme) => localStorage.setItem('cvexe.theme', theme)
};

/** Per-device setting: which model to ask for (empty = server default). */
export const modelSetting = {
	get: () => (typeof localStorage === 'undefined' ? '' : (localStorage.getItem('cvexe.model') ?? '')),
	set: (model: string) => localStorage.setItem('cvexe.model', model.trim())
};
