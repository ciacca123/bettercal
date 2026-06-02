/** Applies committed SQL migrations. Run at container startup before the server. */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './db';

async function main() {
  await migrate(db, { migrationsFolder: 'src/db/migrations' });
  console.log('Migrations applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
