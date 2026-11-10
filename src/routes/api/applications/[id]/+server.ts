import { error, json } from '@sveltejs/kit';
import { deleteApplication, getApplication, updateApplication } from '#lib/server/data.js';
import { body, userId, uuid } from '#lib/server/http.js';
import { toEdits } from '#lib/records.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const app = await getApplication(userId(event), uuid(event.params.id));
	if (!app) error(404, 'Not found');
	return json(app);
};

export const PATCH: RequestHandler = async (event) => {
	if (!(await updateApplication(userId(event), uuid(event.params.id), await body(event, toEdits)))) error(404, 'Not found');
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async (event) => {
	if (!(await deleteApplication(userId(event), uuid(event.params.id)))) error(404, 'Not found');
	return new Response(null, { status: 204 });
};
