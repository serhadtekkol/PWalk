import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';

export async function columnRoutes(fastify: FastifyInstance) {
  const createSchema = z.object({
    name: z.string().min(1).max(60),
    wipLimit: z.number().int().positive().nullable().optional(),
    mappedStatus: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).default('TODO'),
    color: z.string().nullable().optional(),
  });

  const updateSchema = z.object({
    name: z.string().min(1).max(60).optional(),
    wipLimit: z.number().int().positive().nullable().optional(),
    mappedStatus: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
    color: z.string().nullable().optional(),
  });

  const reorderSchema = z.object({
    columnIds: z.array(z.string().min(1)).min(1),
  });

  fastify.get('/api/v1/projects/:id/columns', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    return fastify.prisma.boardColumn.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' },
    });
  });

  fastify.post('/api/v1/projects/:id/columns', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Sütun ekleme yetkiniz yok.' });

    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz sütun bilgisi.' });

    const existing = await fastify.prisma.boardColumn.findMany({ where: { projectId: id } });
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.order), -1);

    const col = await fastify.prisma.boardColumn.create({
      data: {
        projectId: id,
        name: body.data.name.trim(),
        order: maxOrder + 1,
        wipLimit: body.data.wipLimit ?? null,
        mappedStatus: body.data.mappedStatus,
        color: body.data.color ?? null,
      },
    });
    return reply.code(201).send(col);
  });

  fastify.patch('/api/v1/columns/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const col = await fastify.prisma.boardColumn.findUnique({ where: { id } });
    if (!col) return reply.code(404).send({ error: 'Sütun bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, col.projectId, [
      'OWNER',
      'EDITOR',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Sütun düzenleme yetkiniz yok.' });

    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz güncelleme.' });

    return fastify.prisma.boardColumn.update({ where: { id }, data: body.data });
  });

  fastify.delete('/api/v1/columns/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const col = await fastify.prisma.boardColumn.findUnique({ where: { id } });
    if (!col) return reply.code(404).send({ error: 'Sütun bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, col.projectId, [
      'OWNER',
      'EDITOR',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Sütun silme yetkiniz yok.' });

    const taskCount = await fastify.prisma.task.count({ where: { columnId: id } });
    if (taskCount > 0) {
      return reply.code(400).send({ error: 'İçinde görev bulunan sütun silinemez. Önce görevleri taşıyın.' });
    }

    await fastify.prisma.boardColumn.delete({ where: { id } });
    return { ok: true };
  });

  fastify.post(
    '/api/v1/projects/:id/columns/reorder',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
        'OWNER',
        'EDITOR',
      ]);
      if (!perm) return reply.code(403).send({ error: 'Sıralama yetkiniz yok.' });

      const body = reorderSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'Geçersiz sıralama.' });

      await fastify.prisma.$transaction(async (tx) => {
        for (let i = 0; i < body.data.columnIds.length; i++) {
          await tx.boardColumn.update({
            where: { id: body.data.columnIds[i] },
            data: { order: i },
          });
        }
      });

      return fastify.prisma.boardColumn.findMany({
        where: { projectId: id },
        orderBy: { order: 'asc' },
      });
    },
  );
}
