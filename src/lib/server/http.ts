import { error, type RequestEvent } from '@sveltejs/kit';
import { Invalid } from '#lib/records.js';

/** The signed-in user's id (hooks already rejected anonymous API calls). */
export function userId(event: RequestEvent): string {
	if (!event.locals.user) error(401, 'Unauthorized');
	return event.locals.user.id;
}

/** Parse and validate a JSON body; bad input → 400 with the reason. */
export async function body<T>(event: RequestEvent, validate: (b: unknown) => T): Promise<T> {
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		error(400, 'Body must be JSON');
	}
	try {
		return validate(raw);
	} catch (e) {
		if (e instanceof Invalid) error(400, e.message);
		throw e;
	}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(id: string): string {
	if (!UUID.test(id)) error(404, 'Not found');
	return id;
}
