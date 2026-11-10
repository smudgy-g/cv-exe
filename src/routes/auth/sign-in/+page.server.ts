import { fail, redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

function read(form: FormData) {
	return { email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') };
}

export const actions: Actions = {
	signIn: async ({ request }) => {
		const { email, password } = read(await request.formData());
		const { error } = await auth.signIn.email({ email, password });
		if (error) return fail(400, { email, error: error.message || 'Sign-in failed' });
		redirect(303, '/');
	},
	// ponytail: open sign-up for the trial; restrict to an allowlist before going live.
	signUp: async ({ request }) => {
		const { email, password } = read(await request.formData());
		const { error } = await auth.signUp.email({ email, password, name: email.split('@')[0] });
		if (error) return fail(400, { email, error: error.message || 'Sign-up failed' });
		redirect(303, '/');
	}
};
