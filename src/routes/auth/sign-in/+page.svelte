<script lang="ts">
  import { t } from "#lib/i18n.svelte.js";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<svelte:head><title>{t("auth.title")} · CV.exe</title></svelte:head>

<form class="card signin" method="POST" action="?/signIn">
  <h2>{t("auth.title")}</h2>
  <p class="hint">{t("auth.hint")}</p>
  <div class="field">
    <label for="email">{t("auth.email")}</label>
    <input
      id="email"
      name="email"
      type="email"
      autocomplete="email"
      required
      value={form?.email ?? ""}
    />
  </div>
  <div class="field" style="margin-top:14px">
    <label for="password">{t("auth.password")}</label>
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="current-password"
      minlength="8"
      required
    />
  </div>
  {#if form?.error}<p class="status err" role="alert">{form.error}</p>{/if}
  <div class="row">
    <button class="btn">{t("auth.signin")}</button>
    <button class="btn ghost" formaction="?/signUp">{t("auth.signup")}</button>
  </div>
</form>

<style>
  .signin {
    max-width: 440px;
    margin: 6vh auto 0;
  }
</style>
