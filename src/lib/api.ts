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

/** Calls fn() at most once per `ms` of quiet; returns a function to trigger it. */
export function debounce(fn: () => void, ms: number) {
	let timer: ReturnType<typeof setTimeout>;
	return () => {
		clearTimeout(timer);
		timer = setTimeout(fn, ms);
	};
}

/** Per-device setting: which model to ask for (empty = server default). */
export const modelSetting = {
	get: () => (typeof localStorage === 'undefined' ? '' : (localStorage.getItem('cvexe.model') ?? '')),
	set: (v: string) => localStorage.setItem('cvexe.model', v.trim())
};
