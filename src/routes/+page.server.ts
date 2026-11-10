import { getApplication, getProfile } from '#lib/server/data.js';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f-]{36}$/i;

// "Edit ad" from a result comes back here with ?from=<application id> to prefill the ad.
export const load: PageServerLoad = async ({ locals, url }) => {
	const uid = locals.user!.id;
	const from = url.searchParams.get('from');
	const [profile, previous] = await Promise.all([getProfile(uid), from && UUID.test(from) ? getApplication(uid, from) : null]);
	return { hasProfile: !!profile.experience?.trim(), ad: previous?.ad ?? '' };
};
