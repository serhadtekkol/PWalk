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

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    appConfig: AppConfig;
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

  return fastify;
}
