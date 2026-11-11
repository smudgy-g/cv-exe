<script lang="ts">
  import { goto } from "$app/navigation";
  import { errorText, modelSetting } from "#lib/api.js";
  import { t } from "#lib/i18n.svelte.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let ad = $derived(data.ad);
  let notes = $state("");
  let language = $state<"auto" | "fr" | "en">("auto");
  let busy = $state(false);
  let errorMessage = $state("");
  let elapsedSeconds = $state(0);
  let charactersWritten = $state(0);

  async function generate() {
    errorMessage = "";
    busy = true;
    elapsedSeconds = 0;
    charactersWritten = 0;

    const startedAt = Date.now();

    const timer = setInterval(
      () => (elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)),
      1000,
    );

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad,
          notes,
          lang: language,
          model: modelSetting.get() || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));

        errorMessage = errorText(body.message ?? "");

        return;
      }

      // Newline-delimited JSON events: progress…, then done or error.
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += value;

        const lines = buffer.split("\n");

        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line);

          if (event.type === "progress") {
            charactersWritten = event.chars;
          } else if (event.type === "done") {
            return goto(`/applications/${event.app.id}`);
          } else if (event.type === "error") {
            errorMessage = errorText(event.code, event.message);
          }
        }
      }

      if (!errorMessage) errorMessage = errorText("SERVER");
    } catch {
      errorMessage = errorText("NET");
    } finally {
      clearInterval(timer);
      busy = false;
    }
  }

  const formatClock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
</script>

{#if !data.hasProfile}
  <div class="card">
    <h2>{t("setup.title")}</h2>
    <p>{t("setup.text")}</p>
    <a class="btn" href="/profile">{t("setup.go")}</a>
  </div>
{:else}
  <form class="card" onsubmit={(event) => (event.preventDefault(), generate())}>
    <h2>{t("ad.title")}</h2>
    <label for="ad">{t("ad.hint")}</label>
    <textarea
      id="ad"
      class="tall"
      placeholder={t("ad.ph")}
      bind:value={ad}
      disabled={busy}></textarea>
    <label for="notes">{t("notes.label")}</label>
    <textarea
      id="notes"
      style="min-height:60px"
      placeholder={t("notes.ph")}
      bind:value={notes}
      disabled={busy}></textarea>
    <div class="row">
      <select
        style="width:auto"
        bind:value={language}
        disabled={busy}
        aria-label="Language"
      >
        <option value="auto">{t("lang.auto")}</option>
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
      <button class="btn" disabled={busy}>{t("go")}</button>
      <span class="status" class:err={errorMessage} role="status"
        >{errorMessage}</span
      >
    </div>
  </form>

  {#if busy}
    <div class="card">
      <h2>{t("progress.title")}</h2>
      <div class="busy"><div></div></div>
      <p class="hint" style="margin:10px 0 0">
        {t("working")} · {formatClock(elapsedSeconds)}{charactersWritten
          ? ` · ${charactersWritten.toLocaleString()}`
          : ""}
      </p>
    </div>
  {/if}
{/if}
