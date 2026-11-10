<script lang="ts">
	import { onMount } from 'svelte';
	import { modelSetting } from '#lib/api.js';
	import { t } from '#lib/i18n.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let model = $state('');
	let busy = $state(false);
	let fileInput = $state<HTMLInputElement>();
	onMount(() => (model = modelSetting.get()));

	async function exportBackup() {
		const res = await fetch('/api/export');
		const blob = new Blob([JSON.stringify(await res.json(), null, 1)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `cv-exe-${t('backup.file')}-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	// Accepts backups from this app and from the old single-file Easy Apply (same format).
	async function importBackup(file: File) {
		let d;
		try {
			d = JSON.parse(await file.text());
			if (d.app !== 'easy-apply' || typeof d.profile !== 'object' || !Array.isArray(d.apps)) throw 0;
		} catch {
			return alert(t('backup.bad'));
		}
		if (!confirm(t('backup.confirm', d.apps.length))) return;
		busy = true;
		try {
			const send = (url: string, method: string, body?: unknown) =>
				fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => {
					if (!r.ok) throw new Error(`${method} ${url}: ${r.status}`);
				});
			await send('/api/profile', 'PUT', d.profile);
			await send('/api/applications', 'DELETE');
			// Oldest first, one at a time: each request stays small whatever the size of the backup.
			for (const a of [...d.apps].reverse()) await send('/api/applications', 'POST', a);
			alert(t('backup.done'));
		} catch (e) {
			alert(`${t('err.server')}\n${(e as Error).message}`);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t('nav.settings')} · CV.exe</title></svelte:head>

<section class="narrow">
	<p class="pageintro"><span>{t('settings.intro')}</span></p>
	<div class="card">
		<h2>{t('account.title')}</h2>
		<p>{t('account.as', data.user?.email ?? '')}</p>
		<form method="POST" action="/auth/sign-out"><button class="btn ghost">{t('account.signout')}</button></form>
	</div>
	<div class="card">
		<h2>{t('backup.title')}</h2>
		<p class="hint">{t('backup.hint')}</p>
		<div class="row" style="margin-top:0">
			<button class="btn ghost" onclick={exportBackup} disabled={busy}>{t('backup.export')}</button>
			<button class="btn ghost" onclick={() => fileInput?.click()} disabled={busy}>{t('backup.import')}</button>
			<input type="file" accept=".json,application/json" hidden bind:this={fileInput}
				onchange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) importBackup(f); }} />
		</div>
	</div>
	<div class="card">
		<h2>{t('settings.title')}</h2>
		<p class="hint">{t('settings.hint')}</p>
		<div class="field">
			<label for="s-model">{t('settings.model')}</label>
			<input id="s-model" placeholder="anthropic/claude-sonnet-5.5" bind:value={model} oninput={() => modelSetting.set(model)} />
		</div>
	</div>
</section>
