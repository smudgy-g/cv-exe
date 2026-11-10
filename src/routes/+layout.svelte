<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { i18n, setLang, t } from '#lib/i18n.svelte.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	// Set before the page renders (see the note in i18n.svelte.ts).
	// svelte-ignore state_referenced_locally
	i18n.ui = data.ui;

	const tabs = [
		{ href: '/', key: 'nav.apply' },
		{ href: '/profile', key: 'nav.profile' },
		{ href: '/history', key: 'nav.history' },
		{ href: '/settings', key: 'nav.settings' }
	] as const;
	const current = (href: string) =>
		href === '/' ? page.url.pathname === '/' || page.url.pathname.startsWith('/applications/') : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CV.exe</title>
</svelte:head>

<div class="app">
	<header class="top">
		<h1><a href="/">CV<span>.exe</span></a></h1>
		{#if data.user}
			<nav>
				{#each tabs as tab (tab.href)}
					<a href={tab.href} aria-current={current(tab.href) ? 'page' : undefined}>{t(tab.key)}</a>
				{/each}
			</nav>
		{/if}
		<div class="langsw" role="group" aria-label="Language / Langue">
			<button type="button" title="Français" aria-pressed={i18n.ui === 'fr'} onclick={() => setLang('fr')}>FR</button>
			<button type="button" title="English" aria-pressed={i18n.ui === 'en'} onclick={() => setLang('en')}>EN</button>
		</div>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<!-- Filled with the CV or letter just before printing (PDF) -->
<div id="print" class="doc"></div>
