import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '$app/env/private';

/** Tagged-template SQL over HTTP: values are always sent as parameters, never pasted into the query. */
export const sql = neon(DATABASE_URL);
