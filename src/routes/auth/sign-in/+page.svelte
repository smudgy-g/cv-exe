<script lang="ts">
	import type { PageProps } from './$types';
	let { form }: PageProps = $props();
</script>

<main>
	<h1>CV.exe</h1>
	<form method="POST" action="?/signIn">
		<label>Email <input name="email" type="email" autocomplete="email" required value={form?.email ?? ''} /></label>
		<label>Password <input name="password" type="password" autocomplete="current-password" minlength="8" required /></label>
		{#if form?.error}<p role="alert">{form.error}</p>{/if}
		<button>Sign in</button>
		<button formaction="?/signUp">Create account</button>
	</form>
</main>

<style>
	main { max-width: 360px; margin: 10vh auto; font-family: system-ui, sans-serif; }
	label { display: block; margin: 12px 0; }
	input { display: block; width: 100%; padding: 8px; }
	[role='alert'] { color: #b4372f; }
</style>
