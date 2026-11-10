import { getProfile } from '#lib/server/data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ profile: await getProfile(locals.user!.id) });
