import { getApplication, getProfile } from "#lib/server/data.js";
import type { PageServerLoad } from "./$types";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

// "Edit ad" from a result comes back here with ?from=<application id> to prefill the ad.
export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  const fromId = url.searchParams.get("from");

  const [profile, previous] = await Promise.all([
    getProfile(userId),
    fromId && UUID_PATTERN.test(fromId) ? getApplication(userId, fromId) : null,
  ]);

  return { hasProfile: !!profile.experience?.trim(), ad: previous?.ad ?? "" };
};
