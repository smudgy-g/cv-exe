import { json } from '@sveltejs/kit';
import { createApplication, deleteAllApplications, listApplications } from '#lib/server/data.js';
import { parseBody, userId } from '#lib/server/http.js';
import { toNewApplication } from '#lib/records.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => json(await listApplications(userId(event)));

export const POST: RequestHandler = async (event) => {
	const application = await parseBody(event, toNewApplication);

	return json(await createApplication(userId(event), application), { status: 201 });
};

/** Delete the whole history (only called by "Import a backup", after confirmation). */
export const DELETE: RequestHandler = async (event) => {
	await deleteAllApplications(userId(event));

	return new Response(null, { status: 204 });
};
