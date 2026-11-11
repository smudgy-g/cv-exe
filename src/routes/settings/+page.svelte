<script lang="ts">
  import { onMount } from "svelte";
  import { modelSetting } from "#lib/api.js";
  import { t } from "#lib/i18n.svelte.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let model = $state("");
  let busy = $state(false);
  let fileInput = $state<HTMLInputElement>();

  onMount(() => (model = modelSetting.get()));

  async function exportBackup() {
    const response = await fetch("/api/export");

    const blob = new Blob([JSON.stringify(await response.json(), null, 1)], {
      type: "application/json",
    });

    const downloadLink = document.createElement("a");

    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `cv-exe-${t("backup.file")}-${new Date().toISOString().slice(0, 10)}.json`;
    downloadLink.click();

    URL.revokeObjectURL(downloadLink.href);
  }

  // Accepts backups from this app and from the old single-file Easy Apply (same format).
  async function importBackup(file: File) {
    let backup;

    try {
      backup = JSON.parse(await file.text());
    } catch {
      return alert(t("backup.bad"));
    }

    const isValidBackup =
      backup.app === "easy-apply" &&
      typeof backup.profile === "object" &&
      Array.isArray(backup.apps);

    if (!isValidBackup) return alert(t("backup.bad"));

    if (!confirm(t("backup.confirm", backup.apps.length))) return;

    busy = true;

    try {
      const send = (url: string, method: string, body?: unknown) =>
        fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }).then((response) => {
          if (!response.ok)
            throw new Error(`${method} ${url}: ${response.status}`);
        });

      await send("/api/profile", "PUT", backup.profile);
      await send("/api/applications", "DELETE");

      // Oldest first, one at a time: each request stays small whatever the size of the backup.
      for (const application of [...backup.apps].reverse()) {
        await send("/api/applications", "POST", application);
      }

      alert(t("backup.done"));
    } catch (importError) {
      alert(`${t("err.server")}\n${(importError as Error).message}`);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t("nav.settings")} · CV.exe</title></svelte:head>

<section class="narrow">
  <p class="pageintro"><span>{t("settings.intro")}</span></p>
  <div class="card">
    <h2>{t("account.title")}</h2>
    <p>{t("account.as", data.user?.email ?? "")}</p>
    <form method="POST" action="/auth/sign-out">
      <button class="btn ghost">{t("account.signout")}</button>
    </form>
  </div>
  <div class="card">
    <h2>{t("backup.title")}</h2>
    <p class="hint">{t("backup.hint")}</p>
    <div class="row" style="margin-top:0">
      <button class="btn ghost" onclick={exportBackup} disabled={busy}
        >{t("backup.export")}</button
      >
      <button
        class="btn ghost"
        onclick={() => fileInput?.click()}
        disabled={busy}>{t("backup.import")}</button
      >
      <input
        type="file"
        accept=".json,application/json"
        hidden
        bind:this={fileInput}
        onchange={(event) => {
          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";

          if (file) importBackup(file);
        }}
      />
    </div>
  </div>
  <div class="card">
    <h2>{t("settings.title")}</h2>
    <p class="hint">{t("settings.hint")}</p>
    <div class="field">
      <label for="s-model">{t("settings.model")}</label>
      <input
        id="s-model"
        placeholder="anthropic/claude-sonnet-5.5"
        bind:value={model}
        oninput={() => modelSetting.set(model)}
      />
    </div>
  </div>
</section>
