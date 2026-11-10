<script lang="ts">
	import { debounce } from '#lib/api.js';
	import { t } from '#lib/i18n.svelte.js';
	import { PROFILE_FIELDS } from '#lib/records.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let p = $state(Object.fromEntries(PROFILE_FIELDS.map((f) => [f, data.profile[f] ?? ''])) as Record<(typeof PROFILE_FIELDS)[number], string>);
	let saveState = $state<'' | 'saving' | 'saved' | 'error'>('');

	const save = debounce(async () => {
		saveState = 'saving';
		const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => null);
		saveState = res?.ok ? 'saved' : 'error';
	}, 700);
</script>

<svelte:head><title>{t('nav.profile')} · CV.exe</title></svelte:head>

<section class="narrow" oninput={save}>
	<p class="pageintro">
		<span>{t('profile.intro')}</span>
		<span class={saveState === 'error' ? 'status err' : 'saved'} aria-live="polite">
			{saveState === 'saving' ? t('saving') : saveState === 'saved' ? t('saved') : saveState === 'error' ? t('save.err') : ''}
		</span>
	</p>
	<div class="card">
		<h2>{t('contact.title')}</h2>
		<p class="hint">{t('contact.hint')}</p>
		<div class="form">
			<div class="field"><label for="p-name">{t('f.name')}</label><input id="p-name" autocomplete="name" bind:value={p.name} /></div>
			<div class="field"><label for="p-email">Email</label><input id="p-email" type="email" autocomplete="email" bind:value={p.email} /></div>
			<div class="field"><label for="p-phone">{t('f.phone')}</label><input id="p-phone" type="tel" autocomplete="tel" bind:value={p.phone} /></div>
			<div class="field"><label for="p-city">{t('f.city')}</label><input id="p-city" autocomplete="address-level2" bind:value={p.city} /></div>
			<div class="field full"><label for="p-linkedin">{t('f.linkedin')}</label><input id="p-linkedin" type="url" placeholder="https://www.linkedin.com/in/…" bind:value={p.linkedin} /></div>
			<div class="field"><label for="p-github">{t('f.github')}</label><input id="p-github" type="url" placeholder="https://github.com/…" bind:value={p.github} /></div>
			<div class="field"><label for="p-website">{t('f.website')}</label><input id="p-website" type="url" placeholder="https://…" bind:value={p.website} /></div>
		</div>
	</div>
	<div class="card">
		<h2>{t('career.title')}</h2>
		<div class="field">
			<label for="experience">{t('career.label')}</label>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted string from our own translations -->
			<p class="hint">{@html t('career.hint')}</p>
			<textarea id="experience" class="xtall" bind:value={p.experience}></textarea>
		</div>
	</div>
	<div class="card">
		<h2>{t('skills.title')}</h2>
		<div class="form">
			<div class="field full"><label for="p-skills">{t('f.skills')}</label><p class="hint">{t('f.skills.hint')}</p><textarea id="p-skills" class="mid" bind:value={p.skills}></textarea></div>
			<div class="field full"><label for="p-extra">{t('f.extra')}</label><p class="hint">{t('f.extra.hint')}</p><textarea id="p-extra" class="mid" bind:value={p.extraSkills}></textarea></div>
			<div class="field full"><label for="p-langs">{t('f.languages')}</label><input id="p-langs" placeholder={t('f.languages.ph')} bind:value={p.languages} /></div>
		</div>
	</div>
	<div class="card">
		<h2>{t('letters.title')}</h2>
		<div class="field">
			<label for="letters">{t('letters.label')}</label>
			<p class="hint">{t('letters.hint')}</p>
			<textarea id="letters" class="xtall" bind:value={p.letters}></textarea>
		</div>
	</div>
</section>
