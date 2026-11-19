import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true, avatarColor: true } },
  creator: { select: { id: true, name: true, email: true, avatarColor: true } },
  predecessorLinks: true,
  successorLinks: true,
};

export async function taskRoutes(fastify: FastifyInstance) {
  const createSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(10000).nullable().optional(),
    parentId: z.string().nullable().optional(),
    columnId: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    startDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
    dueDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
    estimatedHours: z.number().min(0).max(1000).default(8),
    progress: z.number().int().min(0).max(100).default(0),
    isMilestone: z.boolean().default(false),
    assigneeId: z.string().nullable().optional(),
    tags: z.string().max(2000).nullable().optional(),
  });

  const updateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10000).nullable().optional(),
    parentId: z.string().nullable().optional(),
    columnId: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
    startDate: z.string().min(10).optional(),
    dueDate: z.string().min(10).optional(),
    estimatedHours: z.number().min(0).max(1000).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    isMilestone: z.boolean().optional(),
    assigneeId: z.string().nullable().optional(),
    tags: z.string().max(2000).nullable().optional(),
    cascade: z.boolean().optional(),
  });

  const moveSchema = z.object({
    columnId: z.string().min(1),
    order: z.number().int().min(0),
  });

  fastify.get('/api/v1/tasks/my', { preHandler: [fastify.authenticate] }, async (request) => {
    return fastify.prisma.task.findMany({
      where: { assigneeId: request.authUser.id },
      include: { ...taskInclude, project: true },
      orderBy: { dueDate: 'asc' },
    });
  });

  fastify.get('/api/v1/projects/:id/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const q = request.query as {
      assigneeId?: string;
      priority?: string;
      status?: string;
      search?: string;
      overdue?: string;
    };

    const where: any = { projectId: id };
    if (q.assigneeId) where.assigneeId = q.assigneeId;
    if (q.priority) where.priority = q.priority;
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search };
    if (q.overdue === 'true') {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'DONE' };
    }

    return fastify.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  });

  fastify.post('/api/v1/projects/:id/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Görev oluşturma yetkiniz yok.' });

    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz görev verisi.', details: body.error.flatten() });

    const startDate = new Date(body.data.startDate);
    const dueDate = new Date(body.data.dueDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(dueDate.getTime()) || dueDate < startDate) {
      return reply.code(400).send({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' });
    }

    let columnId = body.data.columnId;
    let status = 'TODO';
    if (columnId) {
      const col = await fastify.prisma.boardColumn.findUnique({ where: { id: columnId } });
      if (!col || col.projectId !== id) return reply.code(400).send({ error: 'Geçersiz Kanban sütunu.' });
      status = col.mappedStatus;
    } else {
      const firstCol = await fastify.prisma.boardColumn.findFirst({
        where: { projectId: id },
        orderBy: { order: 'asc' },
      });
      if (!firstCol) return reply.code(400).send({ error: 'Projede sütun bulunamadı.' });
      columnId = firstCol.id;
      status = firstCol.mappedStatus;
    }

    const task = await fastify.prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id },
        data: { taskSeq: { increment: 1 } },
      });
      const code = `${proj.key}-${proj.taskSeq}`;
      const existingCount = await tx.task.count({ where: { columnId } });

      const created = await tx.task.create({
        data: {
          projectId: id,
          code,
          parentId: body.data.parentId ?? null,
          columnId: columnId!,
          order: existingCount,
          title: body.data.title.trim(),
          description: body.data.description ?? null,
          priority: body.data.priority,
          status,
          startDate,
          dueDate,
          estimatedHours: body.data.isMilestone ? 0 : body.data.estimatedHours,
          progress: body.data.progress,
          isMilestone: body.data.isMilestone,
          assigneeId: body.data.assigneeId ?? null,
          creatorId: request.authUser.id,
        },
        include: taskInclude,
      });

      await tx.taskActivity.create({
        data: {
          taskId: created.id,
          userId: request.authUser.id,
          action: 'CREATED',
          metadata: JSON.stringify({ code: created.code, title: created.title }),
        },
      });

      return created;
    });

    if (task.assigneeId && task.assigneeId !== request.authUser.id && fastify.deliverNotification) {
      await fastify.deliverNotification(task.assigneeId, {
        taskId: task.id,
        type: 'ASSIGNED',
        title: `Yeni Görev Atandı: ${task.code}`,
        body: `${request.authUser.name} size "${task.title}" görevini atadı.`,
      });
    }

    return reply.code(201).send(task);
  });

  fastify.get('/api/v1/tasks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });
    return task;
  });

  fastify.patch('/api/v1/tasks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.task.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(
      fastify.prisma,
      request.authUser.id,
      request.authUser.role,
      existing.projectId,
      ['OWNER', 'EDITOR'],
    );
    if (!perm) return reply.code(403).send({ error: 'Düzenleme yetkiniz yok.' });

    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz güncelleme.', details: body.error.flatten() });

    const startDate = body.data.startDate ? new Date(body.data.startDate) : new Date(existing.startDate);
    const dueDate = body.data.dueDate ? new Date(body.data.dueDate) : new Date(existing.dueDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(dueDate.getTime()) || dueDate < startDate) {
      return reply.code(400).send({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' });
    }

    const { cascade, ...patchFields } = body.data;
    const updated = await fastify.prisma.task.update({
      where: { id },
      data: {
        ...patchFields,
        startDate: patchFields.startDate ? startDate : undefined,
        dueDate: patchFields.dueDate ? dueDate : undefined,
      },
      include: taskInclude,
    });

    if (cascade && (patchFields.startDate || patchFields.dueDate)) {
      const MS_DAY = 86_400_000;
      const projTasks = await fastify.prisma.task.findMany({
        where: { projectId: existing.projectId },
        include: { successorLinks: true },
      });
      const byId = new Map<string, any>(projTasks.map((t: any) => [t.id, t]));
      const queue: string[] = [id];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const curId = queue.shift()!;
        if (visited.has(curId)) continue;
        visited.add(curId);
        const pred = byId.get(curId);
        if (!pred) continue;

        for (const dep of pred.successorLinks ?? []) {
          const succ = byId.get(dep.successorId);
          if (!succ) continue;
          const lagMs = (dep.lagDays ?? 0) * MS_DAY;
          const pStart = new Date(pred.startDate).getTime();
          const pDue = new Date(pred.dueDate).getTime();
          const sStart = new Date(succ.startDate).getTime();
          const sDue = new Date(succ.dueDate).getTime();
          const sSpan = Math.max(0, sDue - sStart);

          let requiredStart = sStart;
          if (dep.type === 'FS') requiredStart = pDue + MS_DAY + lagMs;
          else if (dep.type === 'SS') requiredStart = pStart + lagMs;
          else if (dep.type === 'FF') requiredStart = pDue + lagMs - sSpan;
          else if (dep.type === 'SF') requiredStart = pStart + lagMs - sSpan;

          if (requiredStart > sStart) {
            const newStart = new Date(requiredStart);
            const newDue = new Date(requiredStart + sSpan);
            await fastify.prisma.task.update({
              where: { id: succ.id },
              data: { startDate: newStart, dueDate: newDue },
            });
            succ.startDate = newStart;
            succ.dueDate = newDue;
            queue.push(succ.id);
          }
        }
      }
    }

    await fastify.prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: request.authUser.id,
        action: 'UPDATED',
        metadata: JSON.stringify(Object.keys(body.data)),
      },
    });

    if (
      body.data.assigneeId &&
      body.data.assigneeId !== existing.assigneeId &&
      body.data.assigneeId !== request.authUser.id &&
      fastify.deliverNotification
    ) {
      await fastify.deliverNotification(body.data.assigneeId, {
        taskId: updated.id,
        type: 'ASSIGNED',
        title: `Görev Atandı: ${updated.code}`,
        body: `${request.authUser.name} size "${updated.title}" görevini atadı.`,
      });
    }

    return updated;
  });

  fastify.post('/api/v1/tasks/:id/move', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.task.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(
      fastify.prisma,
      request.authUser.id,
      request.authUser.role,
      existing.projectId,
      ['OWNER', 'EDITOR'],
    );
    if (!perm) return reply.code(403).send({ error: 'Taşıma yetkiniz yok.' });

    const body = moveSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz taşıma isteği.' });

    const targetCol = await fastify.prisma.boardColumn.findUnique({ where: { id: body.data.columnId } });
    if (!targetCol || targetCol.projectId !== existing.projectId) {
      return reply.code(400).send({ error: 'Hedef sütun bu projeye ait değil.' });
    }

    const nextProgress = targetCol.mappedStatus === 'DONE' ? 100 : existing.progress;

    const updated = await fastify.prisma.task.update({
      where: { id },
      data: {
        columnId: targetCol.id,
        order: body.data.order,
        status: targetCol.mappedStatus,
        progress: nextProgress,
      },
      include: taskInclude,
    });

    await fastify.prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: request.authUser.id,
        action: 'STATUS_CHANGED',
        metadata: JSON.stringify({ from: existing.status, to: targetCol.mappedStatus, column: targetCol.name }),
      },
    });

    return updated;
  });

  fastify.delete('/api/v1/tasks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.task.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(
      fastify.prisma,
      request.authUser.id,
      request.authUser.role,
      existing.projectId,
      ['OWNER', 'EDITOR'],
    );
    if (!perm) return reply.code(403).send({ error: 'Silme yetkiniz yok.' });

    await fastify.prisma.$transaction(async (tx) => {
      const allProjectTasks = await tx.task.findMany({ where: { projectId: existing.projectId } });
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of allProjectTasks) {
          if (t.parentId && toDelete.has(t.parentId) && !toDelete.has(t.id)) {
            toDelete.add(t.id);
            changed = true;
          }
        }
      }
      const ids = Array.from(toDelete);

      await tx.taskDependency.deleteMany({
        where: { OR: [{ predecessorId: { in: ids } }, { successorId: { in: ids } }] },
      });
      await tx.notification.deleteMany({ where: { taskId: { in: ids } } });
      await tx.reminder.deleteMany({ where: { taskId: { in: ids } } });
      await tx.taskComment.deleteMany({ where: { taskId: { in: ids } } });
      await tx.taskActivity.deleteMany({ where: { taskId: { in: ids } } });
      await tx.task.updateMany({ where: { id: { in: ids } }, data: { parentId: null } });
      await tx.task.deleteMany({ where: { id: { in: ids } } });
    });

    return { ok: true };
  });
}
