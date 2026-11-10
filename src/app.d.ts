import type { User } from '#lib/server/auth.js';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
}

export {};
