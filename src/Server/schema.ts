import { z } from 'zod';
import type { FastifyServerOptions, FastifyListenOptions } from 'fastify';
import { BasePropsSchema } from '@ramejs/rame';

export const ServerPropsSchema = BasePropsSchema.extend({
  host: z.string().default('0.0.0.0'),
  port: z.number().int().min(0).max(65535).default(3000),
  listen: z.boolean().default(true),

  fastifyOptions: z.custom<FastifyServerOptions>().default({}),
  listenOptions: z.custom<Omit<FastifyListenOptions, 'host' | 'port'>>().default({}),
  onSignal: z.function({ input: z.tuple([]), output: z.void() }).optional(),
  websocket: z.boolean().default(false),
});

export type ServerProps = z.input<typeof ServerPropsSchema>;
