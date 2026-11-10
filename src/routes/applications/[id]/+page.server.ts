import { error } from '@sveltejs/kit';
import { getApplication, getProfile } from '#lib/server/data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const uid = locals.user!.id;
	if (!/^[0-9a-f-]{36}$/i.test(params.id)) error(404, 'Not found');
	const [app, profile] = await Promise.all([getApplication(uid, params.id), getProfile(uid)]);
	if (!app) error(404, 'Not found');
	return { app, hasContact: !!(profile.email && profile.phone), name: profile.name ?? '' };
};
