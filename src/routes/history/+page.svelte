<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { i18n, t } from '#lib/i18n.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	async function remove(id: string) {
		if (!confirm(t('hist.confirm'))) return;
		await fetch(`/api/applications/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}
	const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.ui === 'fr' ? 'fr-FR' : 'en-GB');
</script>

<svelte:head><title>{t('nav.history')} · CV.exe</title></svelte:head>

<section class="narrow">
	<div class="card">
		<h2>{t('hist.title')}</h2>
		{#each data.apps as a (a.id)}
			<div class="hist">
				<div class="grow">
					<b>{a.jobTitle || t('hist.untitled')}</b>{a.company ? ` — ${a.company}` : ''}<br />
					<small>{day(a.date)} · {a.language === 'en' ? 'English' : 'Français'} · {t('kw.short')} {a.keywordsFound}/{a.keywordsTotal}</small>
				</div>
				<a class="btn ghost" href="/applications/{a.id}">{t('hist.open')}</a>
				<button class="btn danger" onclick={() => remove(a.id)}>{t('hist.delete')}</button>
			</div>
		{:else}
			<p class="hint">{t('hist.empty')}</p>
		{/each}
	</div>
</section>
