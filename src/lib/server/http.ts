import { error, type RequestEvent } from '@sveltejs/kit';
import { Invalid } from '#lib/records.js';

/** The signed-in user's id (hooks already rejected anonymous API calls). */
export function userId(event: RequestEvent): string {
	if (!event.locals.user) error(401, 'Unauthorized');

	return event.locals.user.id;
}

/** Parse and validate a JSON body; bad input → 400 with the reason. */
export async function parseBody<T>(event: RequestEvent, validate: (body: unknown) => T): Promise<T> {
	let rawBody: unknown;

	try {
		rawBody = await event.request.json();
	} catch {
		error(400, 'Body must be JSON');
	}

	try {
		return validate(rawBody);
	} catch (validationError) {
		if (validationError instanceof Invalid) error(400, validationError.message);

		throw validationError;
	}
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id if it is a UUID; anything else can't be a row of ours → 404. */
export function requireUuid(id: string): string {
	if (!UUID_PATTERN.test(id)) error(404, 'Not found');

	return id;
}
