import { json } from '@sveltejs/kit';
import { createApplication, deleteAllApplications, listApplications } from '#lib/server/data.js';
import { body, userId } from '#lib/server/http.js';
import { toNewApplication } from '#lib/records.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => json(await listApplications(userId(event)));

export const POST: RequestHandler = async (event) =>
	json(await createApplication(userId(event), await body(event, toNewApplication)), { status: 201 });

/** Delete the whole history (only called by "Import a backup", after confirmation). */
export const DELETE: RequestHandler = async (event) => {
	await deleteAllApplications(userId(event));
	return new Response(null, { status: 204 });
};
