import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireProjectRole } from '../lib/permissions.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  const reminderSchema = z.object({
    remindAt: z.string().min(10),
    message: z.string().max(500).optional(),
  });

  const subscribeSchema = z.object({
    platform: z.enum(['WEB', 'IOS', 'ANDROID']).default('WEB'),
    endpoint: z.string().optional(),
    p256dh: z.string().optional(),
    auth: z.string().optional(),
    deviceToken: z.string().optional(),
  });

  fastify.get('/api/v1/notifications', { preHandler: [fastify.authenticate] }, async (request) => {
    return fastify.prisma.notification.findMany({
      where: { userId: request.authUser.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.patch('/api/v1/notifications/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const notif = await fastify.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== request.authUser.id) {
      return reply.code(404).send({ error: 'Bildirim bulunamadı.' });
    }
    return fastify.prisma.notification.update({ where: { id }, data: { isRead: true } });
  });

  fastify.post('/api/v1/notifications/read-all', { preHandler: [fastify.authenticate] }, async (request) => {
    await fastify.prisma.notification.updateMany({
      where: { userId: request.authUser.id, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  });

  fastify.get('/api/v1/tasks/:id/reminders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    return fastify.prisma.reminder.findMany({
      where: { taskId: id, userId: request.authUser.id },
      orderBy: { remindAt: 'asc' },
    });
  });

  fastify.post('/api/v1/tasks/:id/reminders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await fastify.prisma.task.findUnique({ where: { id } });
    if (!task) return reply.code(404).send({ error: 'Görev bulunamadı.' });
    const perm = await requireProjectRole(fastify.prisma, request.authUser.id, request.authUser.role, task.projectId, [
      'OWNER',
      'EDITOR',
      'VIEWER',
    ]);
    if (!perm) return reply.code(403).send({ error: 'Erişim reddedildi.' });

    const body = reminderSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz hatırlatma zamanı.' });

    const remindAt = new Date(body.data.remindAt);
    if (Number.isNaN(remindAt.getTime())) return reply.code(400).send({ error: 'Geçersiz tarih formatı.' });

    const reminder = await fastify.prisma.reminder.create({
      data: {
        taskId: id,
        userId: request.authUser.id,
        remindAt,
        message: body.data.message,
      },
    });
    return reply.code(201).send(reminder);
  });

  fastify.delete('/api/v1/reminders/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rem = await fastify.prisma.reminder.findUnique({ where: { id } });
    if (!rem || rem.userId !== request.authUser.id) return reply.code(404).send({ error: 'Hatırlatma bulunamadı.' });
    await fastify.prisma.reminder.delete({ where: { id } });
    return { ok: true };
  });

  fastify.get('/api/v1/push/vapid-public-key', async () => {
    return { publicKey: fastify.appConfig.vapidPublicKey || null };
  });

  fastify.post('/api/v1/push/subscribe', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = subscribeSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Geçersiz abonelik verisi.' });

    const sub = await fastify.prisma.pushSubscription.create({
      data: {
        userId: request.authUser.id,
        platform: body.data.platform,
        endpoint: body.data.endpoint ?? null,
        p256dh: body.data.p256dh ?? null,
        auth: body.data.auth ?? null,
        deviceToken: body.data.deviceToken ?? null,
      },
    });
    return reply.code(201).send(sub);
  });

  fastify.delete('/api/v1/push/subscribe', { preHandler: [fastify.authenticate] }, async (request) => {
    const body = request.body as { endpoint?: string; deviceToken?: string };
    if (body?.endpoint) {
      await fastify.prisma.pushSubscription.deleteMany({
        where: { userId: request.authUser.id, endpoint: body.endpoint },
      });
    } else if (body?.deviceToken) {
      await fastify.prisma.pushSubscription.deleteMany({
        where: { userId: request.authUser.id, deviceToken: body.deviceToken },
      });
    }
    return { ok: true };
  });

  fastify.post('/api/v1/push/test', { preHandler: [fastify.authenticate] }, async (request) => {
    if (fastify.deliverNotification) {
      await fastify.deliverNotification(request.authUser.id, {
        type: 'REMINDER',
        title: 'PWalk Test Bildirimi',
        body: 'Push bildirimleri aktif ve sorunsuz çalışıyor.',
      });
    }
    return { ok: true };
  });
}
