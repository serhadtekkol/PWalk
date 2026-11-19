import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryPrisma } from './helpers/memory-prisma.js';

describe('Task 3: Projects, Members & BoardColumns API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberId: string;

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

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin@pmam.local', password: 'Password123!', name: 'Admin' },
    });
    adminToken = r1.json().accessToken;

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'member@pmam.local', password: 'Password123!', name: 'Member' },
    });
    memberToken = r2.json().accessToken;
    memberId = r2.json().user.id;

    const r3 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'outsider@pmam.local', password: 'Password123!', name: 'Outsider' },
    });
    outsiderToken = r3.json().accessToken;
  });

  it('creates project with 4 default columns and enforces non-member 403', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'Mobil Uygulama', key: 'MOB', description: 'iOS & Android' },
    });
    expect(createRes.statusCode).toBe(201);
    const project = createRes.json();
    expect(project.key).toBe('MOB');
    expect(project.columns).toHaveLength(4);
    expect(project.columns.map((c: any) => c.name)).toEqual([
      'Yapılacak',
      'Devam Ediyor',
      'İncelemede',
      'Tamamlandı',
    ]);

    // Outsider (non-member MEMBER role) must get 403
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    // Admin can access any project
    const adminGet = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminGet.statusCode).toBe(200);
  });

  it('manages project members and Kanban columns (create, rename, reorder)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Web Portal', key: 'WEB' },
    });
    const project = createRes.json();

    const addMem = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: memberId, role: 'EDITOR' },
    });
    expect(addMem.statusCode).toBe(201);

    const newCol = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/columns`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'Test', mappedStatus: 'REVIEW', wipLimit: 3 },
    });
    expect(newCol.statusCode).toBe(201);
    expect(newCol.json().wipLimit).toBe(3);

    const colsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/columns`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(colsRes.json()).toHaveLength(5);

    const ids = colsRes.json().map((c: any) => c.id).reverse();
    const reorderRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/columns/reorder`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { columnIds: ids },
    });
    expect(reorderRes.statusCode).toBe(200);
    expect(reorderRes.json()[0].id).toBe(ids[0]);
  });
});
