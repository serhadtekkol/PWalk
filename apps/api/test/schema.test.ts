import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { loadConfig } from '../src/config.js';

describe('Task 1: Config & Prisma Schema', () => {
  it('loads default config values when optional env vars are omitted', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'sqlserver://localhost:1433;database=pmam;user=sa;password=test;trustServerCertificate=true',
      JWT_ACCESS_SECRET: 'access-secret-for-tests-1234567890',
      JWT_REFRESH_SECRET: 'refresh-secret-for-tests-1234567890',
    });
    expect(cfg.port).toBe(4000);
    expect(cfg.ntfyUrl).toBe('http://ntfy');
    expect(cfg.vapidSubject).toBe('mailto:admin@example.com');
  });

  it('validates Prisma MSSQL schema without errors', () => {
    const out = execSync('pnpm exec prisma validate', {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'sqlserver://localhost:1433;database=pmam;user=sa;password=test;trustServerCertificate=true',
      },
    });
    expect(out).toContain('is valid');
  });
});
