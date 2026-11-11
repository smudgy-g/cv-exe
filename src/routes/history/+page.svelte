<script lang="ts">
  import { refreshAll } from "$app/navigation";
  import { i18n, t } from "#lib/i18n.svelte.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  async function remove(id: string) {
    if (!confirm(t("hist.confirm"))) return;

    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    await refreshAll();
  }

  const formatDay = (isoDate: string) =>
    new Date(isoDate).toLocaleDateString(i18n.ui === "fr" ? "fr-FR" : "en-GB");
</script>

<svelte:head><title>{t("nav.history")} · CV.exe</title></svelte:head>

<section class="narrow">
  <div class="card">
    <h2>{t("hist.title")}</h2>
    {#each data.applications as application (application.id)}
      <div class="hist">
        <div class="grow">
          <b>{application.jobTitle || t("hist.untitled")}</b>{application.company
            ? ` — ${application.company}`
            : ""}<br />
          <small
            >{formatDay(application.date)} · {application.language === "en" ? "English" : "Français"} · {t(
              "kw.short",
            )}
            {application.keywordsFound}/{application.keywordsTotal}</small
          >
        </div>
        <a class="btn ghost" href="/applications/{application.id}">{t("hist.open")}</a>
        <button class="btn danger" onclick={() => remove(application.id)}
          >{t("hist.delete")}</button
        >
      </div>
    {:else}
      <p class="hint">{t("hist.empty")}</p>
    {/each}
  </div>
</section>
