import { json } from '@sveltejs/kit';
import { getProfile, saveProfile } from '#lib/server/data.js';
import { body, userId } from '#lib/server/http.js';
import { toProfile } from '#lib/records.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => json(await getProfile(userId(event)));

export const PUT: RequestHandler = async (event) => {
	await saveProfile(userId(event), await body(event, toProfile));
	return new Response(null, { status: 204 });
};
