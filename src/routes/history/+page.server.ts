import { listApplications } from "#lib/server/data.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => ({
  applications: await listApplications(locals.user!.id),
});
