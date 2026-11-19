import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createMemoryPrisma } from './helpers/memory-prisma.js';
import { wouldCreateCycle, computeCriticalPath, computeWorkload } from '../src/services/scheduler-math.js';

describe('Task 5: Dependencies, CPM Critical Path & Workload Engine', () => {
  it('detects self-dependency and multi-hop cycles', () => {
    const edges = [
      { predecessorId: 'A', successorId: 'B' },
      { predecessorId: 'B', successorId: 'C' },
    ];
    expect(wouldCreateCycle(edges, 'A', 'A')).toBe(true);
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true);
    expect(wouldCreateCycle(edges, 'A', 'C')).toBe(false);
  });

  it('computes CPM critical path including zero-duration milestones without NaN', () => {
    const tasks = [
      { id: 'A', startDate: new Date('2026-11-01'), dueDate: new Date('2026-11-04'), isMilestone: false }, // 4d (inclusive)
      { id: 'B', startDate: new Date('2026-11-01'), dueDate: new Date('2026-11-02'), isMilestone: false }, // 2d (inclusive)
      { id: 'M', startDate: new Date('2026-11-04'), dueDate: new Date('2026-11-04'), isMilestone: true },  // 0d
    ];
    const deps = [
      { predecessorId: 'A', successorId: 'M', type: 'FS' as const, lagDays: 0 },
      { predecessorId: 'B', successorId: 'M', type: 'FS' as const, lagDays: 0 },
    ];
    const cpm = computeCriticalPath(tasks, deps);
    expect(cpm.projectDurationDays).toBe(4);
    expect(cpm.criticalTaskIds).toContain('A');
    expect(cpm.criticalTaskIds).toContain('M');
    expect(cpm.criticalTaskIds).not.toContain('B');
    expect(cpm.nodes.M.slackDays).toBe(0);
    expect(cpm.nodes.B.slackDays).toBe(2);
  });

  it('accounts for calendar gaps when tasks are shifted to later dates', () => {
    const tasks = [
      { id: 'A', startDate: new Date('2026-11-01'), dueDate: new Date('2026-11-02'), isMilestone: false }, // 2d
      { id: 'B', startDate: new Date('2026-11-10'), dueDate: new Date('2026-11-12'), isMilestone: false }, // shifted +9d, 3d -> ends day 12
    ];
    const deps = [{ predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 }];
    const cpm = computeCriticalPath(tasks, deps);
    expect(cpm.projectDurationDays).toBe(12);
    expect(cpm.criticalTaskIds).toContain('A');
    expect(cpm.criticalTaskIds).toContain('B');
  });

  it('computes daily workload and flags overloaded days', () => {
    const tasks = [
      {
        id: 'T1',
        assigneeId: 'u1',
        startDate: new Date('2026-11-02T00:00:00Z'),
        dueDate: new Date('2026-11-03T00:00:00Z'), // 2 days -> 6h/day
        estimatedHours: 12,
        isMilestone: false,
        status: 'IN_PROGRESS',
      },
      {
        id: 'T2',
        assigneeId: 'u1',
        startDate: new Date('2026-11-02T00:00:00Z'),
        dueDate: new Date('2026-11-02T00:00:00Z'), // 1 day -> 4h/day
        estimatedHours: 4,
        isMilestone: false,
        status: 'TODO',
      },
    ];
    const members = [{ id: 'u1', name: 'Ali', avatarColor: '#2563eb', dailyCapacityHours: 8 }];
    const report = computeWorkload(tasks, members, new Date('2026-11-02T00:00:00Z'), new Date('2026-11-03T00:00:00Z'));
    expect(report.members[0].days[0].allocatedHours).toBe(10);
    expect(report.members[0].days[0].overloaded).toBe(true);
    expect(report.members[0].days[1].allocatedHours).toBe(6);
    expect(report.members[0].days[1].overloaded).toBe(false);
  });

  describe('HTTP endpoints', () => {
    let app: FastifyInstance;
    let token: string;
    let projectId: string;

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

      const pRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Schedule Test', key: 'SCH' },
      });
      projectId = pRes.json().id;
    });

    it('rejects circular dependency via API with 400 and returns critical-path + workload', async () => {
      const t1 = (
        await app.inject({
          method: 'POST',
          url: `/api/v1/projects/${projectId}/tasks`,
          headers: { authorization: `Bearer ${token}` },
          payload: { title: 'T1', startDate: '2026-11-01T09:00:00Z', dueDate: '2026-11-04T09:00:00Z' },
        })
      ).json();

      const t2 = (
        await app.inject({
          method: 'POST',
          url: `/api/v1/projects/${projectId}/tasks`,
          headers: { authorization: `Bearer ${token}` },
          payload: { title: 'T2', startDate: '2026-11-04T09:00:00Z', dueDate: '2026-11-06T09:00:00Z' },
        })
      ).json();

      const d1 = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t2.id}/dependencies`,
        headers: { authorization: `Bearer ${token}` },
        payload: { predecessorId: t1.id, type: 'FS', lagDays: 0 },
      });
      expect(d1.statusCode).toBe(201);

      const cycle = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${t1.id}/dependencies`,
        headers: { authorization: `Bearer ${token}` },
        payload: { predecessorId: t2.id, type: 'FS', lagDays: 0 },
      });
      expect(cycle.statusCode).toBe(400);

      const cp = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/schedule/critical-path`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(cp.statusCode).toBe(200);
      expect(cp.json().criticalTaskIds).toContain(t1.id);
      expect(cp.json().criticalTaskIds).toContain(t2.id);

      const wl = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectId}/workload?from=2026-11-01&to=2026-11-06`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(wl.statusCode).toBe(200);
      expect(wl.json().members).toHaveLength(1);
    });
  });
});
