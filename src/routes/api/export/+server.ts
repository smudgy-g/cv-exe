import { json } from '@sveltejs/kit';
import { getProfile, listFullApplications } from '#lib/server/data.js';
import { userId } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

// Same shape as the old Easy Apply backups ("app": "easy-apply"), so either version can read the other's file.
export const GET: RequestHandler = async (event) => {
	const currentUserId = userId(event);
	const [profile, applications] = await Promise.all([getProfile(currentUserId), listFullApplications(currentUserId)]);

	return json({ app: 'easy-apply', version: 2, profile, apps: applications });
};
