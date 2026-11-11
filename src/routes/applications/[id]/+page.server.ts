import { error } from "@sveltejs/kit";
import { getApplication, getProfile } from "#lib/server/data.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const userId = locals.user!.id;

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) error(404, "Not found");

  const [application, profile] = await Promise.all([
    getApplication(userId, params.id),
    getProfile(userId),
  ]);

  if (!application) error(404, "Not found");

  return {
    application,
    hasContact: !!(profile.email && profile.phone),
    name: profile.name ?? "",
  };
};
