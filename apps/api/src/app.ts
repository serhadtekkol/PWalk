import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { PrismaClient } from '@prisma/client';
import { loadConfig, type AppConfig } from './config.js';
import { prisma as defaultPrisma } from './lib/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { columnRoutes } from './routes/columns.js';
import { taskRoutes } from './routes/tasks.js';
import { commentRoutes } from './routes/comments.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    appConfig: AppConfig;
    deliverNotification?: (
      userId: string,
      payload: { taskId?: string; type: string; title: string; body: string },
    ) => Promise<void>;
  }
}

export interface BuildAppOptions {
  prisma?: PrismaClient;
  config?: AppConfig;
  enableScheduler?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const prisma = opts.prisma ?? defaultPrisma;

  const fastify = Fastify({ logger: false });

  fastify.decorate('prisma', prisma);
  fastify.decorate('appConfig', config);

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'PMAM Project Management API',
        version: '1.0.0',
        description: 'REST API for PMAM Web & Mobile clients (Kanban, MS Project Gantt/WBS, Push Notifications)',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await fastify.register(authPlugin, { secret: config.jwtAccessSecret });
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(columnRoutes);
  await fastify.register(taskRoutes);
  await fastify.register(commentRoutes);

  return fastify;
}
