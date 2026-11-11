import { proxyAuthRequest } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

const handler: RequestHandler = ({ request, params }) => proxyAuthRequest(request, params.path);

export const GET = handler;
export const POST = handler;
