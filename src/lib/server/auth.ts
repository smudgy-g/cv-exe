// Neon Auth for SvelteKit: the only file that knows which auth provider we use.
// Built on @neon/auth/server, the toolkit Neon provides for frameworks without an official adapter.
import { createAuthServer, handleAuthProxyRequest } from '@neon/auth/server';
import { getRequestEvent } from '$app/server';
import { NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET } from '$app/env/private';

export const auth = createAuthServer({
	baseUrl: NEON_AUTH_BASE_URL,
	cookieSecret: NEON_AUTH_COOKIE_SECRET,
	sameSite: 'lax', // 'strict' would drop the session when arriving from a link in an email or another site
	context: () => {
		const { request, cookies, url } = getRequestEvent();

		return {
			getCookies: () => request.headers.get('cookie') ?? '',
			// Values arrive already encoded and sanitized by the toolkit: pass them through untouched.
			setCookie: (name, value, options) => cookies.set(name, value, { path: '/', ...options, encode: (value) => value }),
			getHeader: (name) => request.headers.get(name),
			getOrigin: () => request.headers.get('origin') ?? url.origin,
			getFramework: () => 'sveltekit'
		};
	}
});

/** Proxies browser-side auth calls (/api/auth/*) to Neon Auth, so cookies belong to our domain. */
export const proxyAuthRequest = (request: Request, path: string) =>
	handleAuthProxyRequest({ request, path, baseUrl: NEON_AUTH_BASE_URL, cookieSecret: NEON_AUTH_COOKIE_SECRET, sameSite: 'lax' });

export type User = { id: string; email: string; name: string };

/** Who is signed in for the current request, or null. */
export async function currentUser(): Promise<User | null> {
	const { data } = await auth.getSession();
	const user = data?.user;

	return user ? { id: user.id, email: user.email, name: user.name } : null;
}
