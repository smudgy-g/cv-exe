<script lang="ts">
	import { bulletStats, coverage, kwTerm, norm, type Keyword } from '#lib/core.js';
	import { HEAD } from '#lib/render.js';
	import { debounce } from '#lib/api.js';
	import { i18n, t } from '#lib/i18n.svelte.js';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const app = $derived(data.app);
	const r = $derived(app.result);

	let cvEl = $state<HTMLDivElement>();
	let letterEl = $state<HTMLDivElement>();
	let doc = $state<'cv' | 'letter'>('cv');
	let saveState = $state<'' | 'saving' | 'saved' | 'error'>('');

	// Everything below is measured on the CV as it is now (same rules before and after tailoring).
	let m = $state({
		matched: [] as Keyword[],
		missing: [] as Keyword[],
		bullets: { total: 0, action: 0, quantified: 0 },
		layoutOk: true,
		missingSections: [] as string[],
		long: 0,
		pages: 0
	});

	function measure() {
		if (!cvEl) return;
		const { matched, missing } = coverage(r.keywords, cvEl.innerText);
		const bullets = [...cvEl.querySelectorAll<HTMLLIElement>('h3 ~ ul li')]; // experience bullets, not skills lines
		let long = 0;
		for (const li of cvEl.querySelectorAll('li.toolong')) li.classList.remove('toolong');
		for (const li of bullets) {
			const n = li.textContent?.length ?? 0;
			const tooLong = n > 220;
			li.classList.toggle('toolong', tooLong);
			if (tooLong) li.title = t('chk.long.tip', n);
			else li.removeAttribute('title');
			long += +tooLong;
		}
		const H = HEAD[r.language] || HEAD.fr;
		const heads = [...cvEl.querySelectorAll('h2')].map((h) => norm(h.textContent));
		m = {
			matched,
			missing,
			bullets: bulletStats(bullets.map((li) => li.textContent ?? '')),
			layoutOk: !cvEl.querySelector('table, img, svg, iframe'),
			missingSections: [H.summary, H.skills, H.exp, H.edu].filter((x) => !heads.includes(norm(x))),
			long,
			// A4 at 96 dpi; only measurable while the CV is visible
			pages: cvEl.offsetHeight ? Math.max(1, Math.round((cvEl.offsetHeight / 1123) * 10) / 10) : m.pages
		};
	}

	// Load the documents into the editable previews when the application changes (not on every keystroke).
	$effect(() => {
		if (cvEl) cvEl.innerHTML = app.cvHtml;
		if (letterEl) letterEl.innerHTML = app.letterHtml;
		untrack(measure); // measure reads and writes m: don't let it re-trigger this effect
	});
	// Re-measure when the CV becomes visible again or the page language changes (tooltips are translated).
	$effect(() => {
		void doc;
		void i18n.ui;
		untrack(measure);
	});

	let pending: { cvHtml?: string; letterHtml?: string } = {};
	const flush = debounce(async () => {
		const body = pending;
		pending = {};
		saveState = 'saving';
		const res = await fetch(`/api/applications/${app.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
		saveState = res?.ok ? 'saved' : 'error';
		if (!res?.ok) pending = { ...body, ...pending }; // retry with the next edit
	}, 800);

	function edited(which: 'cv' | 'letter') {
		const el = which === 'cv' ? cvEl! : letterEl!;
		pending[which === 'cv' ? 'cvHtml' : 'letterHtml'] = el.innerHTML;
		if (which === 'cv') measure();
		flush();
	}

	function pdf() {
		const el = doc === 'cv' ? cvEl! : letterEl!;
		const print = document.getElementById('print')!;
		print.innerHTML = el.innerHTML;
		for (const li of print.querySelectorAll('.toolong')) li.classList.remove('toolong');
		const old = document.title;
		document.title = [doc === 'cv' ? 'CV' : r.language === 'en' ? 'Cover letter' : 'Lettre de motivation', data.name, r.company].filter(Boolean).join(' - ');
		window.print();
		document.title = old;
	}

	const n = $derived((r.keywords || []).length);
	const pct = (x: number, of: number) => (of ? Math.round((100 * x) / of) : 0);
	const before = $derived(app.beforeMatched.length);
	const was = $derived(new Set(app.beforeMatched));
	const undated = $derived((r.cv?.experience || []).filter((e) => !/\d/.test(e.dates || '')).length);
	const bb = $derived(app.beforeBullets);
</script>

<svelte:head><title>{[r.job_title, r.company].filter(Boolean).join(' — ')} · CV.exe</title></svelte:head>

<div class="card">
	<h2>{t('ad.title')}</h2>
	<div class="adbar">
		<b class="grow">{[r.job_title, r.company].filter(Boolean).join(' — ')}</b>
		<a class="btn ghost" href="/?from={app.id}">{t('ad.edit')}</a>
		<a class="btn ghost" href="/">{t('ad.new')}</a>
	</div>
</div>

<div class="workspace">
	<div class="card docpane">
		<div class="doctabs">
			<button class="btn" class:ghost={doc !== 'cv'} onclick={() => (doc = 'cv')}>CV</button>
			<button class="btn" class:ghost={doc !== 'letter'} onclick={() => (doc = 'letter')}>{t('doc.letter')}</button>
			<span class="spacer"></span>
			<span class="status" class:err={saveState === 'error'} role="status">
				{saveState === 'saving' ? t('saving') : saveState === 'saved' ? t('saved') : saveState === 'error' ? t('save.err') : ''}
			</span>
			<button class="btn" id="pdf" onclick={pdf}>{t('pdf')}</button>
		</div>
		<p class="hint">{t('edit.hint')}</p>
		<div class="paper doc" contenteditable="true" bind:this={cvEl} hidden={doc !== 'cv'} oninput={() => edited('cv')}></div>
		<div class="paper doc" contenteditable="true" bind:this={letterEl} hidden={doc !== 'letter'} oninput={() => edited('letter')}></div>
		<details style="margin-top:16px"><summary>{t('sent')}</summary><pre>{app.sent}</pre></details>
	</div>

	<aside class="side">
		<div class="card">
			<h2>{t('score.title')}</h2>
			<h3 class="sub">{t('kw.label')}</h3>
			<div class="stat"><span class="hint">{t('kw.before')}</span><span class="score before">{before}/{n} <small>({pct(before, n)} %)</small></span></div>
			<div class="bar"><div class="before" style:width="{pct(before, n)}%"></div></div>
			<div class="stat"><span class="hint">{t('kw.after')}</span><span class="score">{m.matched.length}/{n} <small>({pct(m.matched.length, n)} %)</small></span></div>
			<div class="bar"><div id="r-bar" style:width="{pct(m.matched.length, n)}%"></div></div>
			{#if m.matched.length > before}
				<div class="gain">{t('kw.gain', m.matched.length - before, pct(m.matched.length, n) - pct(before, n))}</div>
			{/if}
			<div class="chips">
				{#each m.matched as k (kwTerm(k))}
					<span class="chip" class:new={!was.has(kwTerm(k))} title={typeof k === 'string' ? '' : (k.variants || []).join(', ')}>{kwTerm(k)}</span>
				{/each}
				{#each m.missing as k (kwTerm(k))}
					<span class="chip miss" title={typeof k === 'string' ? '' : (k.variants || []).join(', ')}>{kwTerm(k)}</span>
				{/each}
			</div>
			<p class="hint" style="margin-top:8px">{t('kw.hint')}</p>

			<h3 class="sub">{t('ats.title')}</h3>
			{#each [['action', 'ats.action'], ['quantified', 'ats.quant']] as const as [key, label] (key)}
				<div class="stat">
					<span class="hint">{t(label)}</span>
					<span class="score small">
						{#if bb?.total}<small>{bb[key]}/{bb.total} →</small>{/if}
						{m.bullets[key]}/{m.bullets.total} <small>({pct(m.bullets[key], m.bullets.total)} %)</small>
					</span>
				</div>
				<div class="bar"><div style:width="{pct(m.bullets[key], m.bullets.total)}%"></div></div>
			{/each}
			<p class="hint" style="margin-top:8px">{t('ats.hint')}</p>
			<ul class="checks">
				<li class:fail={!m.layoutOk}>{t('chk.layout')}</li>
				<li class:fail={!data.hasContact}>{t('chk.contact')}</li>
				<li class:fail={m.missingSections.length}>
					{m.missingSections.length ? t('chk.sections.miss', m.missingSections.join(', ')) : t('chk.sections')}
				</li>
				<li class:fail={undated}>{undated ? t('chk.dates.miss', undated) : t('chk.dates')}</li>
				<li class:fail={m.long}>{m.long ? t('chk.long.miss', m.long) : t('chk.long')}</li>
				{#if m.pages}<li class:fail={m.pages > 2}>{t('chk.pages', m.pages)}</li>{/if}
			</ul>
		</div>
		<div class="card">
			<h2>{t('gaps.title')}</h2>
			<p class="hint">{t('gaps.hint')}</p>
			<ul class="list">
				{#each r.gaps || [] as g, i (i)}<li>{g}</li>{:else}<li>{t('gaps.none')}</li>{/each}
			</ul>
		</div>
		<div class="card">
			<h2>{t('changes.title')}</h2>
			<p class="hint">{t('changes.hint')}</p>
			<ul class="list">
				{#each r.changes || [] as c, i (i)}<li class:star={c.startsWith('★')}>{c}</li>{:else}<li>—</li>{/each}
			</ul>
		</div>
	</aside>
</div>
