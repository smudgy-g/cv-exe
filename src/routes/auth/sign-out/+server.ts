import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	await auth.signOut();

	redirect(303, '/auth/sign-in');
};
