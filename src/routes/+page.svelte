<script lang="ts">
	import { goto } from '$app/navigation';
	import { errorText, modelSetting } from '#lib/api.js';
	import { t } from '#lib/i18n.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let ad = $state(data.ad);
	let notes = $state('');
	let lang = $state<'auto' | 'fr' | 'en'>('auto');
	let busy = $state(false);
	let err = $state('');
	let elapsed = $state(0);
	let chars = $state(0);

	async function generate() {
		err = '';
		busy = true;
		elapsed = chars = 0;
		const started = Date.now();
		const timer = setInterval(() => (elapsed = Math.round((Date.now() - started) / 1000)), 1000);
		try {
			const res = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ad, notes, lang, model: modelSetting.get() || undefined })
			});
			if (!res.ok || !res.body) {
				const body = await res.json().catch(() => ({}));
				err = errorText(body.message ?? '');
				return;
			}
			// Newline-delimited JSON events: progress…, then done or error.
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (!line.trim()) continue;
					const ev = JSON.parse(line);
					if (ev.type === 'progress') chars = ev.chars;
					else if (ev.type === 'done') return goto(`/applications/${ev.app.id}`);
					else if (ev.type === 'error') err = errorText(ev.code, ev.message);
				}
			}
			if (!err) err = errorText('SERVER');
		} catch {
			err = errorText('NET');
		} finally {
			clearInterval(timer);
			busy = false;
		}
	}

	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

{#if !data.hasProfile}
	<div class="card">
		<h2>{t('setup.title')}</h2>
		<p>{t('setup.text')}</p>
		<a class="btn" href="/profile">{t('setup.go')}</a>
	</div>
{:else}
	<form class="card" onsubmit={(e) => (e.preventDefault(), generate())}>
		<h2>{t('ad.title')}</h2>
		<label for="ad">{t('ad.hint')}</label>
		<textarea id="ad" class="tall" placeholder={t('ad.ph')} bind:value={ad} disabled={busy}></textarea>
		<label for="notes">{t('notes.label')}</label>
		<textarea id="notes" style="min-height:60px" placeholder={t('notes.ph')} bind:value={notes} disabled={busy}></textarea>
		<div class="row">
			<select style="width:auto" bind:value={lang} disabled={busy} aria-label="Language">
				<option value="auto">{t('lang.auto')}</option>
				<option value="fr">Français</option>
				<option value="en">English</option>
			</select>
			<button class="btn" disabled={busy}>{t('go')}</button>
			<span class="status" class:err role="status">{err}</span>
		</div>
	</form>

	{#if busy}
		<div class="card">
			<h2>{t('progress.title')}</h2>
			<div class="busy"><div></div></div>
			<p class="hint" style="margin:10px 0 0">
				{t('working')} · {clock(elapsed)}{chars ? ` · ${chars.toLocaleString()}` : ''}
			</p>
		</div>
	{/if}
{/if}
