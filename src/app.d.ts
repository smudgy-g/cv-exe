import type { User } from '#lib/server/auth.js';
import type { Lang } from '#lib/render.js';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			ui: Lang;
		}
	}
}

export {};
