import { error, json } from '@sveltejs/kit';
import { deleteApplication, getApplication, updateApplication } from '#lib/server/data.js';
import { parseBody, requireUuid, userId } from '#lib/server/http.js';
import { toEdits } from '#lib/records.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const application = await getApplication(userId(event), requireUuid(event.params.id));

	if (!application) error(404, 'Not found');

	return json(application);
};

export const PATCH: RequestHandler = async (event) => {
	const edits = await parseBody(event, toEdits);
	const updated = await updateApplication(userId(event), requireUuid(event.params.id), edits);

	if (!updated) error(404, 'Not found');

	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async (event) => {
	const deleted = await deleteApplication(userId(event), requireUuid(event.params.id));

	if (!deleted) error(404, 'Not found');

	return new Response(null, { status: 204 });
};
