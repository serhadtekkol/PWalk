import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryPrisma } from './helpers/memory-prisma.js';
import { runReminderTick } from '../src/services/reminder-worker.js';

describe('Task 6: Push Notifications, Reminders & Scheduler', () => {
  let app: FastifyInstance;
  let prisma: any;
  let token: string;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    prisma = createMemoryPrisma();
    app = await buildApp({
      prisma,
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
      payload: { name: 'Notif Project', key: 'NTF' },
    });
    projectId = pRes.json().id;
  });

  it('creates reminder, subscribes to Web Push, and avoids duplicate due-soon/overdue notifications on repeated ticks', async () => {
    const now = new Date();
    const dueSoonDate = new Date(now.getTime() + 6 * 3600 * 1000); // within 24h
    const remindAt = new Date(now.getTime() - 60 * 1000);

    const tRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Yaklaşan Görev',
        startDate: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
        dueDate: dueSoonDate.toISOString(),
        assigneeId: userId,
      },
    });
    const taskId = tRes.json().id;

    const remRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/reminders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { remindAt: remindAt.toISOString(), message: 'Kontrol et' },
    });
    expect(remRes.statusCode).toBe(201);

    const subRes = await app.inject({
      method: 'POST',
      url: '/api/v1/push/subscribe',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        platform: 'WEB',
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'key-p256dh',
        auth: 'key-auth',
      },
    });
    expect(subRes.statusCode).toBe(201);

    const deliver = async (uid: string, payload: { taskId?: string; type: string; title: string; body: string }) => {
      await prisma.notification.create({
        data: { userId: uid, taskId: payload.taskId ?? null, type: payload.type, title: payload.title, body: payload.body },
      });
    };

    const tick1 = await runReminderTick(prisma, deliver, now);
    expect(tick1.remindersSent).toBe(1);
    expect(tick1.dueSoonSent).toBe(1);

    // Second tick on the same day must NOT send duplicate reminder or due-soon notification
    const tick2 = await runReminderTick(prisma, deliver, new Date(now.getTime() + 60 * 1000));
    expect(tick2.remindersSent).toBe(0);
    expect(tick2.dueSoonSent).toBe(0);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(2);

    const readAllRes = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(readAllRes.statusCode).toBe(200);
  });
});
