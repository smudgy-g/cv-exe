<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
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
	// Phone menu: closes on navigation, Escape, or a tap outside the header.
	let menuOpen = $state(false);
	afterNavigate(() => (menuOpen = false));
	function closeOnOutside(e: MouseEvent) {
		if (menuOpen && !(e.target as Element).closest('header.top')) menuOpen = false;
	}

	const current = (href: string) =>
		href === '/' ? page.url.pathname === '/' || page.url.pathname.startsWith('/applications/') : page.url.pathname.startsWith(href);
</script>

<svelte:window onclick={closeOnOutside} onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

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
		{#snippet langSwitch()}
			<div class="langsw" role="group" aria-label="Language / Langue">
				<button type="button" title="Français" aria-pressed={i18n.ui === 'fr'} onclick={() => setLang('fr')}>FR</button>
				<button type="button" title="English" aria-pressed={i18n.ui === 'en'} onclick={() => setLang('en')}>EN</button>
			</div>
		{/snippet}
		<div class="desktop-lang">{@render langSwitch()}</div>

		<!-- Phones: "New application" stays one tap away, everything else is in the menu -->
		{#if data.user}
			<a class="mobile-new" href="/" aria-current={current('/') ? 'page' : undefined}>{t('nav.apply')}</a>
		{/if}
		<button class="menu-btn" type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" onclick={() => (menuOpen = !menuOpen)}>
			<span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
			<span class="sr-only">{t('nav.menu')}</span>
		</button>
		{#if menuOpen}
			<div id="mobile-menu" class="mobile-menu">
				{#if data.user}
					{#each tabs.slice(1) as tab (tab.href)}
						<a href={tab.href} aria-current={current(tab.href) ? 'page' : undefined}>{t(tab.key)}</a>
					{/each}
				{/if}
				<div class="menu-lang"><span>{t('nav.language')}</span>{@render langSwitch()}</div>
			</div>
		{/if}
	</header>

	<main>
		{@render children()}
	</main>
</div>

<!-- Filled with the CV or letter just before printing (PDF) -->
<div id="print" class="doc"></div>
