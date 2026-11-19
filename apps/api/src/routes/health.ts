import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/health', async () => {
    return { status: 'ok', service: 'pmam-api', timestamp: new Date().toISOString() };
  });
}
