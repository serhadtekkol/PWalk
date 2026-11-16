import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../config.js';

export interface NotificationPayload {
  taskId?: string;
  type: string;
  title: string;
  body: string;
}

export function createNotificationDeliverer(prisma: PrismaClient, config: AppConfig) {
  const hasVapid = Boolean(config.vapidPublicKey && config.vapidPrivateKey);
  if (hasVapid) {
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  }

  return async function deliverNotification(userId: string, payload: NotificationPayload): Promise<void> {
    await prisma.notification.create({
      data: {
        userId,
        taskId: payload.taskId ?? null,
        type: payload.type,
        title: payload.title,
        body: payload.body,
      },
    });

    const [subs, user] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (hasVapid) {
      for (const sub of subs) {
        if (sub.platform === 'WEB' && sub.endpoint && sub.p256dh && sub.auth) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify({
                title: payload.title,
                body: payload.body,
                taskId: payload.taskId,
                type: payload.type,
              }),
            );
          } catch (err: any) {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      }
    }

    if (user?.ntfyTopic && config.ntfyUrl) {
      try {
        await fetch(`${config.ntfyUrl}/${encodeURIComponent(user.ntfyTopic)}`, {
          method: 'POST',
          headers: {
            Title: payload.title,
            Priority: payload.type === 'OVERDUE' ? 'high' : 'default',
          },
          body: payload.body,
        });
      } catch {
        // Non-fatal if ntfy is temporarily unreachable
      }
    }
  };
}
