import { z } from 'zod';
import { BasePropsSchema } from '@ramejs/rame';
import type { WebsocketHandler } from '@fastify/websocket';

export const WebsocketPropsSchema = BasePropsSchema.extend({
  path: z.string(),
  handler: z.custom<WebsocketHandler>(),
});

export type WebsocketProps = z.input<typeof WebsocketPropsSchema>;
