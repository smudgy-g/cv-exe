<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import {
    appendSkills,
    bulletStats,
    coverage,
    insertBullets,
    keywordTerm,
    normalizeText,
    type Keyword,
  } from "#lib/core.js";
  import { HEADINGS } from "#lib/render.js";
  import { paginate } from "#lib/print.js";
  import {
    debounce,
    errorText,
    generateApplication,
    modelSetting,
    THEMES,
    themeSetting,
    type Theme,
  } from "#lib/api.js";
  import { i18n, t } from "#lib/i18n.svelte.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const application = $derived(data.application);
  const result = $derived(application.result);

  let cvElement = $state<HTMLDivElement>();
  let letterElement = $state<HTMLDivElement>();
  let activeDocument = $state<"cv" | "letter">("cv");
  let saveState = $state<"" | "saving" | "saved" | "error">("");
  let theme = $state<Theme>("classic");

  onMount(() => (theme = themeSetting.get()));

  // Everything below is measured on the CV as it is now (same rules before and after tailoring).
  let metrics = $state({
    matched: [] as Keyword[],
    missing: [] as Keyword[],
    bullets: { total: 0, action: 0, quantified: 0 },
    layoutOk: true,
    missingSections: [] as string[],
    tooLongBullets: 0,
    pages: 0,
  });

  function measure() {
    if (!cvElement) return;

    const { matched, missing } = coverage(result.keywords, cvElement.innerText);

    // Experience bullets, not skills lines
    const bulletItems = [
      ...cvElement.querySelectorAll<HTMLLIElement>("h3 ~ ul li"),
    ];

    let tooLongBullets = 0;

    for (const highlighted of cvElement.querySelectorAll("li.toolong")) {
      highlighted.classList.remove("toolong");
    }

    for (const bulletItem of bulletItems) {
      const characterCount = bulletItem.textContent?.length ?? 0;
      const tooLong = characterCount > 220;

      bulletItem.classList.toggle("toolong", tooLong);

      if (tooLong) bulletItem.title = t("chk.long.tip", characterCount);
      else bulletItem.removeAttribute("title");

      if (tooLong) tooLongBullets++;
    }

    const headings = HEADINGS[result.language] || HEADINGS.fr;

    const sectionHeadings = [...cvElement.querySelectorAll("h2")].map(
      (heading) => normalizeText(heading.textContent),
    );

    const requiredHeadings = [
      headings.summary,
      headings.skills,
      headings.experience,
      headings.education,
    ];

    metrics = {
      matched,
      missing,
      bullets: bulletStats(
        bulletItems.map((bulletItem) => bulletItem.textContent ?? ""),
      ),
      layoutOk: !cvElement.querySelector("table, img, svg, iframe"),
      missingSections: requiredHeadings.filter(
        (required) => !sectionHeadings.includes(normalizeText(required)),
      ),
      tooLongBullets,
      // A4 at 96 dpi; only measurable while the CV is visible
      pages: cvElement.offsetHeight
        ? Math.max(1, Math.round((cvElement.offsetHeight / 1123) * 10) / 10)
        : metrics.pages,
    };
  }

  // Load the documents into the editable previews when the application changes (not on every keystroke).
  $effect(() => {
    if (cvElement) cvElement.innerHTML = application.cvHtml;

    if (letterElement) letterElement.innerHTML = application.letterHtml;

    untrack(measure); // measure reads and writes metrics: don't let it re-trigger this effect
  });

  // Re-measure when the CV becomes visible again or the page language changes (tooltips are translated).
  $effect(() => {
    void activeDocument;
    void i18n.ui;
    void theme; // styles change the CV's height (page count)

    untrack(measure);
  });

  let pendingEdits: { cvHtml?: string; letterHtml?: string } = {};

  const saveEdits = debounce(async () => {
    const edits = pendingEdits;

    pendingEdits = {};
    saveState = "saving";

    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    }).catch(() => null);

    saveState = response?.ok ? "saved" : "error";

    if (!response?.ok) pendingEdits = { ...edits, ...pendingEdits }; // retry with the next edit
  }, 800);

  function onEdited(documentType: "cv" | "letter") {
    if (documentType === "cv") {
      pendingEdits.cvHtml = cvElement!.innerHTML;
      measure();
    } else {
      pendingEdits.letterHtml = letterElement!.innerHTML;
    }

    saveEdits();
  }

  // combined: cover letter then CV in one PDF, the letter's own page first.
  function printPdf(combined = false) {
    const printContainer = document.getElementById("print")!;

    printContainer.innerHTML = combined
      ? `${letterElement!.innerHTML}<div class="pagebreak"></div>${cvElement!.innerHTML}`
      : (activeDocument === "cv" ? cvElement! : letterElement!).innerHTML;
    printContainer.className = `doc theme-${theme}`;

    for (const highlighted of printContainer.querySelectorAll(".toolong")) {
      highlighted.classList.remove("toolong");
    }

    paginate(printContainer, (HEADINGS[result.language] || HEADINGS.fr).continued);

    const letterName = result.language === "en" ? "Cover letter" : "Lettre de motivation";

    const documentName = combined
      ? `CV + ${letterName}`
      : activeDocument === "cv"
        ? "CV"
        : letterName;

    // The browser suggests the page title as the PDF file name.
    const originalTitle = document.title;

    document.title = [documentName, data.name, result.company]
      .filter(Boolean)
      .join(" - ");

    window.print();

    document.title = originalTitle;
  }

  // Same ad and language, fresh generation from the current profile; the result is a new application.
  let instructions = $state("");
  let regenerating = $state(false);
  let regenerateError = $state("");
  let charactersWritten = $state(0);

  async function regenerate() {
    regenerating = true;
    regenerateError = "";
    charactersWritten = 0;

    const outcome = await generateApplication(
      { ad: application.ad, notes: instructions, lang: result.language },
      (characters) => (charactersWritten = characters),
    );

    regenerating = false;

    if ("id" in outcome) {
      instructions = "";

      return goto(`/applications/${outcome.id}`);
    }

    regenerateError = outcome.error;
  }

  // "Enhance CV": in the "Missing from your CV" card the user ticks keywords and requirements they really have.
  // The AI makes each a skill ("Other skills") or a bullet under the right job; the user reviews them in a drawer,
  // then they are saved to "My profile" (and this CV regenerated from it).
  type Proposal = { item: string; kind: "skill" | "bullet"; after: string; text: string };
  type Job = { label: string; after: string };

  let picked = $state<Record<string, string>>({}); // keyword or requirement → the user's note on where/how
  let proposals = $state<Proposal[]>([]);
  let jobs = $state<Job[]>([]);
  let enhanceState = $state<"" | "writing" | "saving">("");
  let enhanceError = $state("");
  let enhanceNotice = $state("");
  let drawer = $state<HTMLDialogElement>();
  let enhanceRequest: AbortController | null = null;

  const missingKeywords = $derived(metrics.missing.map(keywordTerm));
  const missingRequirements = $derived(result.gaps || []);
  const pickedCount = $derived(Object.keys(picked).length);

  function togglePick(item: string) {
    if (item in picked) delete picked[item];
    else picked[item] = "";

    enhanceNotice = "";
  }

  async function enhance() {
    const request = new AbortController();

    enhanceRequest = request;
    enhanceState = "writing";
    enhanceError = "";
    enhanceNotice = "";
    proposals = [];
    drawer!.showModal();

    const items = Object.entries(picked).map(([text, note]) => ({ text, note }));

    const response = await fetch("/api/profile/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, model: modelSetting.get() || undefined }),
      signal: request.signal,
    }).catch(() => null);

    const body = (await response?.json().catch(() => ({}))) ?? {};

    if (request.signal.aborted) return; // the drawer was closed meanwhile

    enhanceState = "";

    if (!response?.ok) {
      enhanceError = response
        ? errorText(body.message ?? "", body.detail)
        : errorText("NET");

      return;
    }

    proposals = body.additions;
    jobs = body.jobs ?? [];

    if (!proposals.length) enhanceError = t("enh.none");
  }

  // Closing the drawer (Cancel, Escape, or after saving) drops the suggestions; the ticks stay unless saved.
  function onDrawerClose() {
    enhanceRequest?.abort();
    enhanceState = "";
    enhanceError = "";
    proposals = [];
  }

  function switchKind(proposal: Proposal) {
    proposal.kind = proposal.kind === "skill" ? "bullet" : "skill";

    if (proposal.kind === "bullet" && !proposal.after) proposal.after = jobs[0]?.after ?? "";
  }

  async function saveProposals(thenRegenerate: boolean) {
    enhanceState = "saving";
    enhanceError = "";

    const kept = proposals.filter((proposal) => proposal.text.trim());

    try {
      const profileResponse = await fetch("/api/profile");

      if (!profileResponse.ok) throw new Error();

      const profile = await profileResponse.json();

      profile.experience = insertBullets(
        profile.experience || "",
        kept
          .filter((proposal) => proposal.kind === "bullet")
          .map((proposal) => ({ after: proposal.after, bullet: proposal.text })),
      );

      profile.extraSkills = appendSkills(
        profile.extraSkills || "",
        kept
          .filter((proposal) => proposal.kind === "skill")
          .map((proposal) => proposal.text),
      );

      const saveResponse = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!saveResponse.ok) throw new Error();
    } catch {
      enhanceState = "";
      enhanceError = errorText("SERVER");

      return;
    }

    picked = {};
    drawer!.close();

    if (thenRegenerate) regenerate();
    else enhanceNotice = t("enh.saved");
  }

  const percent = (part: number, total: number) =>
    total ? Math.round((100 * part) / total) : 0;

  const keywordCount = $derived((result.keywords || []).length);
  const matchedBeforeCount = $derived(application.beforeMatched.length);
  const matchedBefore = $derived(new Set(application.beforeMatched));
  const beforeBullets = $derived(application.beforeBullets);

  const undatedJobs = $derived(
    (result.cv?.experience || []).filter((job) => !/\d/.test(job.dates || ""))
      .length,
  );

  const variantsTitle = (keyword: Keyword) =>
    typeof keyword === "string" ? "" : (keyword.variants || []).join(", ");
</script>

<svelte:head
  ><title>{[result.job_title, result.company].filter(Boolean).join(" — ")} · CV.exe</title
  ></svelte:head
>

<div class="card">
  <h2>{t("ad.title")}</h2>
  <div class="adbar">
    <b class="grow">{[result.job_title, result.company].filter(Boolean).join(" — ")}</b>
    <a class="btn ghost" href="/?from={application.id}">{t("ad.edit")}</a>
    <a class="btn ghost" href="/">{t("ad.new")}</a>
  </div>
  <form
    onsubmit={(event) => (event.preventDefault(), regenerate())}
    style="margin-top:12px"
  >
    <label for="instructions">{t("regen.label")}</label>
    <textarea
      id="instructions"
      style="min-height:60px"
      placeholder={t("regen.ph")}
      bind:value={instructions}
      disabled={regenerating}
    ></textarea>
    <div class="row">
      <button class="btn" disabled={regenerating}>{t("regen.go")}</button>
      <span class="status" class:err={regenerateError} role="status"
        >{regenerateError}</span
      >
    </div>
    <p class="hint">{t("regen.hint")}</p>
  </form>
  {#if regenerating}
    <div class="busy"><div></div></div>
    <p class="hint" style="margin:10px 0 0">
      {t("working")}{charactersWritten
        ? ` · ${charactersWritten.toLocaleString()}`
        : ""}
    </p>
  {/if}
</div>

<div class="workspace">
  <div class="card docpane">
    <div class="doctabs">
      <button
        class="btn"
        class:ghost={activeDocument !== "cv"}
        onclick={() => (activeDocument = "cv")}>CV</button
      >
      <button
        class="btn"
        class:ghost={activeDocument !== "letter"}
        onclick={() => (activeDocument = "letter")}>{t("doc.letter")}</button
      >
      <select
        class="style-select"
        aria-label={t("style.label")}
        bind:value={theme}
        onchange={() => themeSetting.set(theme)}
      >
        {#each THEMES as themeName (themeName)}<option value={themeName}
            >{t("style.label")} : {t(`style.${themeName}`)}</option
          >{/each}
      </select>
      <span class="spacer"></span>
      <span class="status" class:err={saveState === "error"} role="status">
        {saveState === "saving"
          ? t("saving")
          : saveState === "saved"
            ? t("saved")
            : saveState === "error"
              ? t("save.err")
              : ""}
      </span>
      <button class="btn" id="pdf" onclick={() => printPdf()}>{t("pdf")}</button>
      <button class="btn ghost" onclick={() => printPdf(true)}>{t("pdf.both")}</button>
    </div>
    <p class="hint">{t("edit.hint")}</p>
    <div
      class="paper doc theme-{theme}"
      contenteditable="true"
      bind:this={cvElement}
      hidden={activeDocument !== "cv"}
      oninput={() => onEdited("cv")}
    ></div>
    <div
      class="paper doc theme-{theme}"
      contenteditable="true"
      bind:this={letterElement}
      hidden={activeDocument !== "letter"}
      oninput={() => onEdited("letter")}
    ></div>
    <details style="margin-top:16px">
      <summary>{t("sent")}</summary>
      <pre>{application.sent}</pre>
    </details>
  </div>

  <aside class="side">
    <div class="card">
      <h2>{t("score.title")}</h2>
      <h3 class="sub">{t("kw.label")}</h3>
      <div class="stat">
        <span class="hint">{t("kw.before")}</span><span class="score before"
          >{matchedBeforeCount}/{keywordCount}
          <small>({percent(matchedBeforeCount, keywordCount)} %)</small></span
        >
      </div>
      <div class="bar">
        <div class="before" style:width="{percent(matchedBeforeCount, keywordCount)}%"></div>
      </div>
      <div class="stat">
        <span class="hint">{t("kw.after")}</span><span class="score"
          >{metrics.matched.length}/{keywordCount}
          <small>({percent(metrics.matched.length, keywordCount)} %)</small></span
        >
      </div>
      <div class="bar">
        <div id="r-bar" style:width="{percent(metrics.matched.length, keywordCount)}%"></div>
      </div>
      {#if metrics.matched.length > matchedBeforeCount}
        <div class="gain">
          {t(
            "kw.gain",
            metrics.matched.length - matchedBeforeCount,
            percent(metrics.matched.length, keywordCount) -
              percent(matchedBeforeCount, keywordCount),
          )}
        </div>
      {/if}
      <div class="chips">
        {#each metrics.matched as keyword (keywordTerm(keyword))}
          <span
            class="chip"
            class:new={!matchedBefore.has(keywordTerm(keyword))}
            title={variantsTitle(keyword)}>{keywordTerm(keyword)}</span
          >
        {/each}
      </div>
      <p class="hint" style="margin-top:8px">{t("kw.hint")}</p>
      {#if missingKeywords.length + missingRequirements.length}
        <a class="missing-link" href="#missing"
          >{t("missing.link", missingKeywords.length + missingRequirements.length)}</a
        >
      {/if}

      <h3 class="sub">{t("ats.title")}</h3>
      {#each [["action", "ats.action"], ["quantified", "ats.quant"]] as const as [key, label] (key)}
        <div class="stat">
          <span class="hint">{t(label)}</span>
          <span class="score small">
            {#if beforeBullets?.total}<small
                >{beforeBullets[key]}/{beforeBullets.total} →</small
              >{/if}
            {metrics.bullets[key]}/{metrics.bullets.total}
            <small
              >({percent(metrics.bullets[key], metrics.bullets.total)} %)</small
            >
          </span>
        </div>
        <div class="bar">
          <div style:width="{percent(metrics.bullets[key], metrics.bullets.total)}%"></div>
        </div>
      {/each}
      <p class="hint" style="margin-top:8px">{t("ats.hint")}</p>
      <ul class="checks">
        <li class:fail={!metrics.layoutOk}>{t("chk.layout")}</li>
        <li class:fail={!data.hasContact}>{t("chk.contact")}</li>
        <li class:fail={metrics.missingSections.length}>
          {metrics.missingSections.length
            ? t("chk.sections.miss", metrics.missingSections.join(", "))
            : t("chk.sections")}
        </li>
        <li class:fail={undatedJobs}>
          {undatedJobs ? t("chk.dates.miss", undatedJobs) : t("chk.dates")}
        </li>
        <li class:fail={metrics.tooLongBullets}>
          {metrics.tooLongBullets
            ? t("chk.long.miss", metrics.tooLongBullets)
            : t("chk.long")}
        </li>
        {#if metrics.pages}<li class:fail={metrics.pages > 2}>
            {t("chk.pages", metrics.pages)}
          </li>{/if}
      </ul>
    </div>
    <div class="card" id="missing">
      <h2>{t("missing.title")}</h2>
      {#if missingKeywords.length + missingRequirements.length}
        <p class="hint">{t("missing.hint")}</p>
        {#each [["missing.keywords", missingKeywords], ["missing.requirements", missingRequirements]] as const as [heading, items] (heading)}
          {#if items.length}
            <h3 class="sub">{t(heading)}</h3>
            <ul class="missing-list">
              {#each items as item (item)}
                <li class:picked={item in picked}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item in picked}
                      onchange={() => togglePick(item)}
                      disabled={regenerating}
                    />
                    <span>{item}</span>
                  </label>
                  {#if item in picked}
                    <input
                      type="text"
                      aria-label={t("enh.note.label")}
                      placeholder={t("enh.note.ph")}
                      maxlength="500"
                      bind:value={picked[item]}
                      disabled={regenerating}
                    />
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/each}
        <div class="row">
          <button
            type="button"
            class="btn"
            onclick={enhance}
            disabled={!pickedCount || regenerating}>{t("enh.go", pickedCount)}</button
          >
          {#if pickedCount}
            <button type="button" class="btn ghost" onclick={() => (picked = {})} disabled={regenerating}
              >{t("enh.clear")}</button
            >
          {/if}
          <span class="status" role="status">{enhanceNotice}</span>
        </div>
      {:else}
        <p>{t("missing.none")}</p>
      {/if}
    </div>
    <div class="card">
      <h2>{t("changes.title")}</h2>
      <p class="hint">{t("changes.hint")}</p>
      <ul class="list">
        {#each result.changes || [] as change, index (index)}<li
            class:star={change.startsWith("★")}
          >
            {change}
          </li>{:else}<li>—</li>{/each}
      </ul>
    </div>
  </aside>
</div>

<dialog
  class="drawer"
  bind:this={drawer}
  aria-labelledby="enhance-title"
  onclose={onDrawerClose}
  oncancel={(event) => enhanceState === "saving" && event.preventDefault()}
>
  <header>
    <h2 id="enhance-title">{t("enh.title")}</h2>
  </header>
  <div class="drawer-body">
    {#if enhanceState === "writing"}
      <div class="busy"><div></div></div>
      <p class="hint">{t("enh.writing")}</p>
    {:else if proposals.length}
      <p class="hint">{t("enh.review")}</p>
      {#if proposals.some((proposal) => proposal.kind === "skill")}
        <h3 class="sub">{t("enh.skills")}</h3>
      {/if}
      {#each proposals as proposal, index (index)}
        {#if proposal.kind === "skill"}
          <div class="proposal">
            <input type="text" aria-label={proposal.item} bind:value={proposal.text} disabled={!!enhanceState} />
            <div class="row">
              <button type="button" class="btn ghost" onclick={() => switchKind(proposal)} disabled={!!enhanceState}
                >{t("enh.makeBullet")}</button
              >
              <button type="button" class="btn ghost" onclick={() => proposals.splice(index, 1)} disabled={!!enhanceState}
                >{t("enh.remove")}</button
              >
            </div>
          </div>
        {/if}
      {/each}
      {#if proposals.some((proposal) => proposal.kind === "bullet")}
        <h3 class="sub">{t("enh.experience")}</h3>
      {/if}
      {#each proposals as proposal, index (index)}
        {#if proposal.kind === "bullet"}
          <div class="proposal">
            <select aria-label={t("enh.job")} bind:value={proposal.after} disabled={!!enhanceState}>
              {#each jobs as job (job.after)}<option value={job.after}>{job.label}</option>{/each}
              {#if proposal.after && !jobs.some((job) => job.after === proposal.after)}
                <option value={proposal.after}>{t("enh.under", proposal.after.trim())}</option>
              {/if}
              <option value="">{t("enh.atEnd")}</option>
            </select>
            <textarea aria-label={proposal.item} bind:value={proposal.text} disabled={!!enhanceState}></textarea>
            <div class="row">
              <button type="button" class="btn ghost" onclick={() => switchKind(proposal)} disabled={!!enhanceState}
                >{t("enh.makeSkill")}</button
              >
              <button type="button" class="btn ghost" onclick={() => proposals.splice(index, 1)} disabled={!!enhanceState}
                >{t("enh.remove")}</button
              >
            </div>
          </div>
        {/if}
      {/each}
    {/if}
    <p class="status" class:err={enhanceError} role="status">
      {enhanceError || (enhanceState === "saving" ? t("enh.saving") : "")}
    </p>
  </div>
  <footer class="row">
    {#if proposals.length}
      <button type="button" class="btn" onclick={() => saveProposals(true)} disabled={!!enhanceState || regenerating}
        >{t("enh.save")}</button
      >
      <button type="button" class="btn ghost" onclick={() => saveProposals(false)} disabled={!!enhanceState}
        >{t("enh.saveOnly")}</button
      >
    {/if}
    <button type="button" class="btn ghost" onclick={() => drawer!.close()} disabled={enhanceState === "saving"}
      >{t("enh.cancel")}</button
    >
  </footer>
</dialog>
