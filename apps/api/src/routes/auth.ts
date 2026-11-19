import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

const AVATAR_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#4f46e5'];

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sanitizeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarColor: user.avatarColor,
    role: user.role,
    dailyCapacityHours: user.dailyCapacityHours,
    ntfyTopic: user.ntfyTopic,
    createdAt: user.createdAt,
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2).max(80),
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const refreshSchema = z.object({
    refreshToken: z.string().min(10),
  });

  const updateMeSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    dailyCapacityHours: z.number().min(1).max(24).optional(),
    ntfyTopic: z.string().max(120).nullable().optional(),
    avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  });

  async function issueTokens(user: any) {
    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      { expiresIn: '15m' },
    );
    const rawRefresh = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await fastify.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt,
      },
    });
    return { accessToken, refreshToken: rawRefresh };
  }

  fastify.post('/api/v1/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Geçersiz kayıt bilgileri.', details: body.error.flatten() });
    }
    const email = body.data.email.toLowerCase().trim();
    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const userCount = await fastify.prisma.user.count();
    const passwordHash = await bcrypt.hash(body.data.password, 10);
    const avatarColor = AVATAR_COLORS[userCount % AVATAR_COLORS.length];

    const user = await fastify.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.data.name.trim(),
        avatarColor,
        role: userCount === 0 ? 'ADMIN' : 'MEMBER',
      },
    });

    const tokens = await issueTokens(user);
    return reply.code(201).send({ user: sanitizeUser(user), ...tokens });
  });

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'E-posta ve şifre gereklidir.' });
    }
    const email = body.data.email.toLowerCase().trim();
    const user = await fastify.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: 'E-posta veya şifre hatalı.' });
    }
    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'E-posta veya şifre hatalı.' });
    }
    const tokens = await issueTokens(user);
    return reply.send({ user: sanitizeUser(user), ...tokens });
  });

  fastify.post('/api/v1/auth/refresh', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Refresh token gereklidir.' });
    }
    const tokenHash = hashToken(body.data.refreshToken);
    const stored = await fastify.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || new Date(stored.expiresAt) < new Date()) {
      return reply.code(401).send({ error: 'Geçersiz veya süresi dolmuş oturum.' });
    }
    const user = await fastify.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      return reply.code(401).send({ error: 'Kullanıcı bulunamadı.' });
    }
    await fastify.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens(user);
    return reply.send({ user: sanitizeUser(user), ...tokens });
  });

  fastify.post('/api/v1/auth/logout', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (body.success) {
      const tokenHash = hashToken(body.data.refreshToken);
      await fastify.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    return reply.send({ ok: true });
  });

  fastify.get('/api/v1/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({ where: { id: request.authUser.id } });
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı.' });
    return reply.send(sanitizeUser(user));
  });

  fastify.patch('/api/v1/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = updateMeSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Geçersiz profil bilgisi.', details: body.error.flatten() });
    }
    const updated = await fastify.prisma.user.update({
      where: { id: request.authUser.id },
      data: body.data,
    });
    return reply.send(sanitizeUser(updated));
  });

  fastify.get('/api/v1/users', { preHandler: [fastify.authenticate] }, async () => {
    const users = await fastify.prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(sanitizeUser);
  });
}
