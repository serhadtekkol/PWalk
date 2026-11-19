import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryPrisma } from './helpers/memory-prisma.js';

describe('Task 2: Fastify Auth & Health API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const prisma = createMemoryPrisma();
    app = await buildApp({
      prisma: prisma as any,
      config: {
        databaseUrl: 'sqlserver://localhost:1433;database=pmam_test',
        jwtAccessSecret: 'test-access-secret-1234567890abcdef',
        jwtRefreshSecret: 'test-refresh-secret-1234567890abcdef',
        vapidPublicKey: '',
        vapidPrivateKey: '',
        vapidSubject: 'mailto:test@example.com',
        ntfyUrl: 'http://ntfy',
        port: 4000,
      },
      enableScheduler: false,
    });
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('registers first user as ADMIN, second as MEMBER, rejects duplicate email with 409', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin@pmam.local', password: 'Password123!', name: 'Admin User' },
    });
    expect(r1.statusCode).toBe(201);
    expect(r1.json().user.role).toBe('ADMIN');
    expect(r1.json().accessToken).toBeTruthy();
    expect(r1.json().refreshToken).toBeTruthy();

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'member@pmam.local', password: 'Password123!', name: 'Member User' },
    });
    expect(r2.statusCode).toBe(201);
    expect(r2.json().user.role).toBe('MEMBER');

    const rDup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin@pmam.local', password: 'Password123!', name: 'Dup' },
    });
    expect(rDup.statusCode).toBe(409);
  });

  it('logs in, accesses /me, refreshes token, and updates profile', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'u1@pmam.local', password: 'Password123!', name: 'User One' },
    });

    const unauth = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(unauth.statusCode).toBe(401);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'u1@pmam.local', password: 'Password123!' },
    });
    expect(loginRes.statusCode).toBe(200);
    const { accessToken, refreshToken } = loginRes.json();

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe('u1@pmam.local');

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Updated Name', dailyCapacityHours: 6, ntfyTopic: 'pmam-u1' },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().name).toBe('Updated Name');
    expect(patchRes.json().dailyCapacityHours).toBe(6);
    expect(patchRes.json().ntfyTopic).toBe('pmam-u1');

    const refRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refRes.statusCode).toBe(200);
    expect(refRes.json().accessToken).toBeTruthy();
    expect(refRes.json().refreshToken).not.toBe(refreshToken);
  });
});
