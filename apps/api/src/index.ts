import { execSync } from 'node:child_process';
import { loadConfig } from './config.js';
import { ensureDatabaseExists } from './lib/ensure-db.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  await ensureDatabaseExists(config.databaseUrl);

  // Sync Prisma schema to MSSQL database on startup
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });

  const app = await buildApp({ config, enableScheduler: true });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`PMAM API listening on http://0.0.0.0:${config.port}`);
}

main().catch((err) => {
  console.error('Failed to start PMAM API:', err);
  process.exit(1);
});
