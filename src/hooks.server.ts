import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { currentUser } from "#lib/server/auth.js";
import { pickLang } from "#lib/i18n.svelte.js";

const PUBLIC_PATHS = ["/auth/", "/api/auth/"];

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.ui = pickLang(
    event.cookies.get("ui"),
    event.request.headers.get("accept-language"),
  );

  event.locals.user = await currentUser();

  const isPublic = PUBLIC_PATHS.some((path) =>
    event.url.pathname.startsWith(path),
  );

  if (!event.locals.user && !isPublic) {
    if (event.url.pathname.startsWith("/api/"))
      return new Response("Unauthorized", { status: 401 });

    redirect(303, "/auth/sign-in");
  }

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace("%lang%", event.locals.ui),
  });
};
