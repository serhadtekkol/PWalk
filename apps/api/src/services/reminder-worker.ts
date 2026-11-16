import type { PrismaClient } from '@prisma/client';
import type { NotificationPayload } from './push.js';

export type DeliverFn = (userId: string, payload: NotificationPayload) => Promise<void>;

export async function runReminderTick(
  prisma: PrismaClient,
  deliver: DeliverFn,
  now: Date = new Date(),
): Promise<{ remindersSent: number; dueSoonSent: number; overdueSent: number }> {
  let remindersSent = 0;
  let dueSoonSent = 0;
  let overdueSent = 0;

  // 1. Custom reminders
  const dueReminders = await prisma.reminder.findMany({
    where: { sentAt: null, remindAt: { lte: now } },
    include: { task: true },
  });

  for (const rem of dueReminders) {
    await deliver(rem.userId, {
      taskId: rem.taskId,
      type: 'REMINDER',
      title: `Hatırlatma: ${rem.task?.code ?? 'Görev'}`,
      body: rem.message || rem.task?.title || 'Planlanan hatırlatma zamanı geldi.',
    });
    await prisma.reminder.update({ where: { id: rem.id }, data: { sentAt: now } });
    remindersSent++;
  }

  // 2. Due-soon (within 24h) and Overdue tasks (once per day per task/user/type)
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const openTasks = await prisma.task.findMany({
    where: {
      status: { not: 'DONE' },
      dueDate: { lte: next24h },
    },
  });

  for (const task of openTasks) {
    if (!task.assigneeId) continue;
    const due = new Date(task.dueDate);
    const type = due < now ? 'OVERDUE' : 'DUE_SOON';

    const alreadySentToday = await prisma.notification.findFirst({
      where: {
        userId: task.assigneeId,
        taskId: task.id,
        type,
        createdAt: { gte: dayStart },
      },
    });
    if (alreadySentToday) continue;

    await deliver(task.assigneeId, {
      taskId: task.id,
      type,
      title: type === 'OVERDUE' ? `Geciken Görev: ${task.code}` : `Yaklaşan Bitiş: ${task.code}`,
      body:
        type === 'OVERDUE'
          ? `"${task.title}" görevinin bitiş tarihi geçti.`
          : `"${task.title}" görevinin bitişine 24 saatten az kaldı.`,
    });

    if (type === 'OVERDUE') overdueSent++;
    else dueSoonSent++;
  }

  return { remindersSent, dueSoonSent, overdueSent };
}

export function startReminderScheduler(prisma: PrismaClient, deliver: DeliverFn, intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => {
    runReminderTick(prisma, deliver).catch((err) => {
      console.error('Reminder scheduler tick error:', err);
    });
  }, intervalMs);
}
