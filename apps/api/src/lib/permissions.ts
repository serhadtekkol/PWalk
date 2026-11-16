import type { PrismaClient } from '@prisma/client';

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export async function requireProjectRole(
  prisma: PrismaClient,
  userId: string,
  systemRole: string,
  projectId: string,
  allowed: ProjectRole[],
) {
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });

  if (systemRole === 'ADMIN') {
    return member ?? { id: 'admin-override', projectId, userId, role: 'OWNER' as ProjectRole };
  }

  if (!member || !allowed.includes(member.role as ProjectRole)) {
    return null;
  }

  return member;
}
