import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';

export async function commentRoutes(fastify: FastifyInstance) {
  const commentSchema = z.object({
    body: z.string().min(1).max(5000),
  });

  fastify.get('/api/v1/tasks/:id/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    return fastify.prisma.taskComment.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: 'asc' },
    });
  });

  fastify.post('/api/v1/tasks/:id/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Yorum boş olamaz.' });

    const comment = await fastify.prisma.taskComment.create({
      data: {
        taskId: id,
        userId: request.authUser.id,
        body: parsed.data.body.trim(),
      },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    });

    await fastify.prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: request.authUser.id,
        action: 'COMMENTED',
        metadata: JSON.stringify({ commentId: comment.id }),
      },
    });

    if (task.assigneeId && task.assigneeId !== request.authUser.id && fastify.deliverNotification) {
      await fastify.deliverNotification(task.assigneeId, {
        taskId: task.id,
        type: 'COMMENT',
        title: `Yeni Yorum: ${task.code}`,
        body: `${request.authUser.name}: ${comment.body.slice(0, 100)}`,
      });
    }

    // Parse @mentions and notify matching project members
    if (fastify.deliverNotification) {
      const mentionMatches = comment.body.match(/@([A-Za-zÇĞİÖŞÜçğıöşü0-9._-]+)/g);
      if (mentionMatches && mentionMatches.length > 0) {
        const memberships = await fastify.prisma.projectMember.findMany({
          where: { projectId: task.projectId },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        const tokens = new Set(mentionMatches.map((m: string) => m.slice(1).toLowerCase()));
        const notifiedIds = new Set<string>();
        if (task.assigneeId) notifiedIds.add(task.assigneeId);

        for (const m of memberships) {
          const u = m.user;
          if (!u || u.id === request.authUser.id || notifiedIds.has(u.id)) continue;
          const firstName = u.name.split(/\s+/)[0]?.toLowerCase() ?? '';
          const fullCompact = u.name.replace(/\s+/g, '').toLowerCase();
          const emailLocal = u.email.split('@')[0]?.toLowerCase() ?? '';
          if (tokens.has(firstName) || tokens.has(fullCompact) || tokens.has(emailLocal)) {
            notifiedIds.add(u.id);
            await fastify.deliverNotification(u.id, {
              taskId: task.id,
              type: 'MENTION',
              title: `Bahsedildiniz: ${task.code}`,
              body: `${request.authUser.name} sizi etiketledi: ${comment.body.slice(0, 100)}`,
            });
          }
        }
      }
    }

    return reply.code(201).send(comment);
  });

  fastify.get('/api/v1/tasks/:id/activity', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });

    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    return fastify.prisma.taskActivity.findMany({
      where: { taskId: id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });
}
