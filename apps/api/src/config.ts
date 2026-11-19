import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:admin@example.com'),
  NTFY_URL: z.string().optional().default('http://ntfy'),
  PORT: z.coerce.number().int().positive().optional().default(4000),
});

export interface AppConfig {
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  ntfyUrl: string;
  port: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
    vapidPublicKey: parsed.VAPID_PUBLIC_KEY,
    vapidPrivateKey: parsed.VAPID_PRIVATE_KEY,
    vapidSubject: parsed.VAPID_SUBJECT,
    ntfyUrl: parsed.NTFY_URL.replace(/\/+$/, ''),
    port: parsed.PORT,
  };
}
