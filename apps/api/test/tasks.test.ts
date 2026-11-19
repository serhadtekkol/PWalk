import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryPrisma } from './helpers/memory-prisma.js';

describe('Task 4: Tasks, Subtasks, Kanban Move, Comments & Activity API', () => {
  let app: FastifyInstance;
  let token: string;
  let userId: string;
  let projectId: string;
  let columns: any[];

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
      payload: { email: 'owner@pmam.local', password: 'Password123!', name: 'Owner' },
    });
    token = r1.json().accessToken;
    userId = r1.json().user.id;

    const pRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'PMAM Core', key: 'PM' },
    });
    projectId = pRes.json().id;
    columns = pRes.json().columns;
  });

  it('rejects task creation when dueDate < startDate with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Invalid dates',
        startDate: '2026-11-20T09:00:00Z',
        dueDate: '2026-11-18T09:00:00Z',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates task + subtask, moves on Kanban, adds comment, and deletes parent transactionally', async () => {
    const t1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Ana Görev',
        priority: 'HIGH',
        startDate: '2026-11-17T09:00:00Z',
        dueDate: '2026-11-21T17:00:00Z',
        estimatedHours: 16,
        assigneeId: userId,
      },
    });
    expect(t1.statusCode).toBe(201);
    const parent = t1.json();
    expect(parent.code).toBe('PM-1');

    const t2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Alt Görev',
        parentId: parent.id,
        startDate: '2026-11-17T09:00:00Z',
        dueDate: '2026-11-19T17:00:00Z',
      },
    });
    expect(t2.statusCode).toBe(201);
    expect(t2.json().code).toBe('PM-2');

    // Move parent to DONE column
    const doneCol = columns.find((c) => c.mappedStatus === 'DONE');
    const moveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${parent.id}/move`,
      headers: { authorization: `Bearer ${token}` },
      payload: { columnId: doneCol.id, order: 0 },
    });
    expect(moveRes.statusCode).toBe(200);
    expect(moveRes.json().status).toBe('DONE');
    expect(moveRes.json().progress).toBe(100);

    // Add comment & check activity
    const cRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${parent.id}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body: 'İlk yorum' },
    });
    expect(cRes.statusCode).toBe(201);

    const actRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${parent.id}/activity`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(actRes.statusCode).toBe(200);
    expect(actRes.json().length).toBeGreaterThanOrEqual(2);

    // Delete parent task transactionally (must also clean up subtask)
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${parent.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.json()).toHaveLength(0);
  });
});
