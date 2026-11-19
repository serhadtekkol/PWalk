import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance, opts: { secret: string }) => {
  await fastify.register(jwt, {
    secret: opts.secret,
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<{ sub: string; email: string; name: string; role: 'ADMIN' | 'MEMBER' }>();
      request.authUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
    } catch {
      return reply.code(401).send({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
    }
  });
});
