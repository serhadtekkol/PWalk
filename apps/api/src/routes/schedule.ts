import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';
import { computeCriticalPath, computeWorkload, wouldCreateCycle } from '../services/scheduler-math.js';

export async function scheduleRoutes(fastify: FastifyInstance) {
  const depSchema = z.object({
    predecessorId: z.string().min(1),
    type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
    lagDays: z.number().int().min(-365).max(365).default(0),
  });

  fastify.post('/api/v1/tasks/:id/dependencies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: successorId } = request.params as { id: string };
    const successor = await fastify.prisma.task.findUnique({ where: { id: successorId } });
    if (!successor) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(
      fastify.prisma,
      request.authUser.id,
      request.authUser.role,
      successor.projectId,
      ['OWNER', 'EDITOR'],
    );
    if (!perm) return reply.code(403).send({ error: 'Bağımlılık ekleme yetkiniz yok.' });

    const body = depSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz bağımlılık.' });

    const predecessor = await fastify.prisma.task.findUnique({ where: { id: body.data.predecessorId } });
    if (!predecessor || predecessor.projectId !== successor.projectId) {
      return reply.code(400).send({ error: 'Öncül görev aynı projede olmalıdır.' });
    }

    const projectTasks = await fastify.prisma.task.findMany({ where: { projectId: successor.projectId } });
    const taskIds = projectTasks.map((t) => t.id);
    const existingDeps = await fastify.prisma.taskDependency.findMany({
      where: { predecessorId: { in: taskIds } },
    });

    if (wouldCreateCycle(existingDeps, body.data.predecessorId, successorId)) {
      return reply.code(400).send({ error: 'Döngüsel bağımlılık oluşturulamaz.' });
    }

    const duplicate = existingDeps.find(
      (d) => d.predecessorId === body.data.predecessorId && d.successorId === successorId,
    );
    if (duplicate) {
      return reply.code(409).send({ error: 'Bu bağımlılık zaten mevcut.' });
    }

    const dep = await fastify.prisma.taskDependency.create({
      data: {
        predecessorId: body.data.predecessorId,
        successorId,
        type: body.data.type,
        lagDays: body.data.lagDays,
      },
    });
    return reply.code(201).send(dep);
  });

  fastify.delete('/api/v1/dependencies/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dep = await fastify.prisma.taskDependency.findUnique({ where: { id } });
    if (!dep) return reply.code(404).send({ error: 'Bağımlılık bulunamadı.' });

    const task = await fastify.prisma.task.findUnique({ where: { id: dep.successorId } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(
      fastify.prisma,
      request.authUser.id,
      request.authUser.role,
      task.projectId,
      ['OWNER', 'EDITOR'],
    );
    if (!perm) return reply.code(403).send({ error: 'Silme yetkiniz yok.' });

    await fastify.prisma.taskDependency.delete({ where: { id } });
    return { ok: true };
  });

  fastify.get(
    '/api/v1/projects/:id/schedule/critical-path',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
        'OWNER',
        'EDITOR',
        'VIEWER',
      ]);
      if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

      const tasks = await fastify.prisma.task.findMany({ where: { projectId: id } });
      const taskIds = tasks.map((t) => t.id);
      const deps =
        taskIds.length > 0
          ? await fastify.prisma.taskDependency.findMany({ where: { predecessorId: { in: taskIds } } })
          : [];

      return computeCriticalPath(tasks, deps);
    },
  );

  fastify.get('/api/v1/projects/:id/workload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const q = request.query as { from?: string; to?: string };
    const now = new Date();
    const from = q.from ? new Date(q.from) : new Date(now.getTime() - 3 * 86_400_000);
    const to = q.to ? new Date(q.to) : new Date(now.getTime() + 11 * 86_400_000);

    const [tasks, memberships] = await Promise.all([
      fastify.prisma.task.findMany({ where: { projectId: id } }),
      fastify.prisma.projectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, avatarColor: true, dailyCapacityHours: true } } },
      }),
    ]);

    const members = memberships
      .map((m: any) => m.user)
      .filter(Boolean);

    return computeWorkload(tasks, members, from, to);
  });

  fastify.post('/api/v1/projects/:id/schedule/baseline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Baseline alma yetkiniz yok.' });

    const tasks = await fastify.prisma.task.findMany({ where: { projectId: id } });
    for (const t of tasks) {
      await fastify.prisma.task.update({
        where: { id: t.id },
        data: { baselineStartDate: t.startDate, baselineDueDate: t.dueDate },
      });
    }
    return { ok: true, updatedCount: tasks.length };
  });

  fastify.get('/api/v1/projects/:id/export/csv', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const [project, tasks] = await Promise.all([
      fastify.prisma.project.findUnique({ where: { id } }),
      fastify.prisma.task.findMany({
        where: { projectId: id },
        include: { assignee: { select: { name: true } } },
        orderBy: { code: 'asc' },
      }),
    ]);

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Kod', 'Başlık', 'Durum', 'Öncelik', 'Sorumlu', 'Başlangıç', 'Bitiş', 'İlerleme (%)', 'Tahmini Saat', 'Etiketler'].join(',');
    const rows = tasks.map((t: any) =>
      [
        esc(t.code),
        esc(t.title),
        esc(t.status),
        esc(t.priority),
        esc(t.assignee?.name ?? 'Atanmamış'),
        esc(new Date(t.startDate).toISOString().slice(0, 10)),
        esc(new Date(t.dueDate).toISOString().slice(0, 10)),
        esc(t.progress),
        esc(t.estimatedHours),
        esc(t.tags ?? ''),
      ].join(','),
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const filename = `${(project?.key ?? 'project').toLowerCase()}-tasks.csv`;
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  });

  fastify.get('/api/v1/projects/:id/export/ics', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const [project, tasks] = await Promise.all([
      fastify.prisma.project.findUnique({ where: { id } }),
      fastify.prisma.task.findMany({ where: { projectId: id }, orderBy: { dueDate: 'asc' } }),
    ]);

    const fmtDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10).replace(/-/g, '');
    const escIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PWalk//Project Schedule//TR',
      `X-WR-CALNAME:${escIcs(project?.name ?? 'PWalk Proje')}`,
    ];
    for (const t of tasks) {
      const endPlusOne = new Date(new Date(t.dueDate).getTime() + 86_400_000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${t.id}@pmam`,
        `DTSTART;VALUE=DATE:${fmtDate(t.startDate)}`,
        `DTEND;VALUE=DATE:${fmtDate(endPlusOne)}`,
        `SUMMARY:${escIcs(`${t.code}: ${t.title}`)}`,
        `DESCRIPTION:${escIcs(t.description ?? '')}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    const filename = `${(project?.key ?? 'project').toLowerCase()}-schedule.ics`;
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(lines.join('\r\n'));
  });
}
