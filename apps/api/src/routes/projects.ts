import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';

const DEFAULT_COLUMNS = [
  { name: 'Yapılacak', order: 0, mappedStatus: 'TODO', color: '#64748b' },
  { name: 'Devam Ediyor', order: 1, mappedStatus: 'IN_PROGRESS', color: '#2563eb' },
  { name: 'İncelemede', order: 2, mappedStatus: 'REVIEW', color: '#d97706' },
  { name: 'Tamamlandı', order: 3, mappedStatus: 'DONE', color: '#16a34a' },
];

export async function projectRoutes(fastify: FastifyInstance) {
  const createSchema = z.object({
    name: z.string().min(2).max(120),
    key: z.string().min(2).max(10).regex(/^[A-Za-z0-9]+$/),
    description: z.string().max(2000).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  });

  const updateSchema = z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  });

  const addMemberSchema = z.object({
    userId: z.string().min(1),
    role: z.enum(['OWNER', 'EDITOR', 'VIEWER']).default('EDITOR'),
  });

  const updateMemberSchema = z.object({
    role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
  });

  fastify.get('/api/v1/projects', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id: userId, role } = request.authUser;
    const where = role === 'ADMIN' ? {} : { members: { some: { userId } } };
    return fastify.prisma.project.findMany({
      where,
      include: {
        columns: true,
        members: { include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/api/v1/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Geçersiz proje bilgileri.', details: body.error.flatten() });
    }
    const key = body.data.key.toUpperCase();
    const existing = await fastify.prisma.project.findUnique({ where: { key } });
    if (existing) {
      return reply.code(409).send({ error: 'Bu proje anahtarı (key) zaten kullanılıyor.' });
    }

    const project = await fastify.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: body.data.name.trim(),
          key,
          description: body.data.description,
          color: body.data.color ?? '#0f172a',
        },
      });
      await tx.projectMember.create({
        data: { projectId: created.id, userId: request.authUser.id, role: 'OWNER' },
      });
      await tx.boardColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ ...c, projectId: created.id })),
      });
      return tx.project.findUnique({
        where: { id: created.id },
        include: {
          columns: true,
          members: { include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } } },
        },
      });
    });

    return reply.code(201).send(project);
  });

  fastify.get('/api/v1/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Bu projeye erişim yetkiniz yok.' });

    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: {
        columns: true,
        members: { include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } } },
      },
    });
    if (!project) return reply.code(404).send({ error: 'Proje bulunamadı.' });
    return project;
  });

  fastify.patch('/api/v1/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, ['OWNER']);
    if (!perm) return reply.code(403).send({ error: 'Proje ayarlarını değiştirme yetkiniz yok.' });

    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz güncelleme.', details: body.error.flatten() });

    const updated = await fastify.prisma.project.update({ where: { id }, data: body.data });
    return updated;
  });

  fastify.delete('/api/v1/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, ['OWNER']);
    if (!perm) return reply.code(403).send({ error: 'Projeyi silme yetkiniz yok.' });

    await fastify.prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({ where: { projectId: id } });
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length > 0) {
        await tx.taskDependency.deleteMany({
          where: { OR: [{ predecessorId: { in: taskIds } }, { successorId: { in: taskIds } }] },
        });
        await tx.notification.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.reminder.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskActivity.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.updateMany({ where: { projectId: id }, data: { parentId: null } });
        await tx.task.deleteMany({ where: { projectId: id } });
      }
      await tx.boardColumn.deleteMany({ where: { projectId: id } });
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });

    return { ok: true };
  });

  fastify.get('/api/v1/projects/:id/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    return fastify.prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true, dailyCapacityHours: true } } },
    });
  });

  fastify.post('/api/v1/projects/:id/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, ['OWNER']);
    if (!perm) return reply.code(403).send({ error: 'Üye ekleme yetkiniz yok.' });

    const body = addMemberSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz üye bilgisi.' });

    const existing = await fastify.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: body.data.userId } },
    });
    if (existing) return reply.code(409).send({ error: 'Kullanıcı zaten proje üyesi.' });

    const member = await fastify.prisma.projectMember.create({
      data: { projectId: id, userId: body.data.userId, role: body.data.role },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
    });
    return reply.code(201).send(member);
  });

  fastify.patch(
    '/api/v1/projects/:id/members/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, ['OWNER']);
      if (!perm) return reply.code(403).send({ error: 'Rol güncelleme yetkiniz yok.' });

      const body = updateMemberSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'Geçersiz rol.' });

      const updated = await fastify.prisma.projectMember.update({
        where: { projectId_userId: { projectId: id, userId } },
        data: { role: body.data.role },
      });
      return updated;
    },
  );

  fastify.delete(
    '/api/v1/projects/:id/members/:userId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, id, ['OWNER']);
      if (!perm) return reply.code(403).send({ error: 'Üye çıkarma yetkiniz yok.' });

      await fastify.prisma.projectMember.deleteMany({ where: { projectId: id, userId } });
      return { ok: true };
    },
  );
}
