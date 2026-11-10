import { sql } from '#lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Trial check: the signed-in user exists in Neon Auth's own table.
	const rows = await sql`select email from neon_auth."user" where id = ${locals.user!.id}`;
	return { user: locals.user!, inDatabase: rows.length === 1 };
};
