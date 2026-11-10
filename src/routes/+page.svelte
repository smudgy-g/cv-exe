<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<main>
	<h1>CV.exe: auth trial</h1>
	<p>Signed in as <b>{data.user.email}</b> (id {data.user.id})</p>
	<p>Found in neon_auth.user: <b>{data.inDatabase ? 'yes ✓' : 'no ✗'}</b></p>
	<form method="POST" action="/auth/sign-out"><button>Sign out</button></form>
</main>

<style>
	main { max-width: 560px; margin: 10vh auto; font-family: system-ui, sans-serif; }
</style>
