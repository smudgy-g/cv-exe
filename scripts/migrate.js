// Applies migrations/*.sql in order, each once, each in a transaction.
// Run: npm run db:migrate   (reads DATABASE_URL_UNPOOLED or DATABASE_URL from .env)
import { Pool } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
const db = await pool.connect();
try {
	await db.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
	const done = new Set((await db.query('select name from schema_migrations')).rows.map((r) => r.name));
	const files = (await readdir(new URL('../migrations', import.meta.url))).filter((f) => f.endsWith('.sql')).sort();
	for (const f of files) {
		if (done.has(f)) continue;
		const text = await readFile(new URL(`../migrations/${f}`, import.meta.url), 'utf8');
		await db.query('begin');
		try {
			await db.query(text);
			await db.query('insert into schema_migrations (name) values ($1)', [f]);
			await db.query('commit');
			console.log('applied', f);
		} catch (e) {
			await db.query('rollback');
			throw new Error(`${f} failed, nothing from it was applied: ${e.message}`);
		}
	}
	console.log('database up to date');
} finally {
	db.release();
	await pool.end();
}
