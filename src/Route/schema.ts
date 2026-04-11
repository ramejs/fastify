import { z } from 'zod';
import { BasePropsSchema, type RameNode } from '@ramejs/rame';
import type { FastifyRequest, FastifyReply, FastifySchema } from 'fastify';
import { HttpMethod } from '../types';

const RouteReplySchema = z
  .object({
    status: z.number(),
    body: z.json(),
  })
  .strict();

export type RouteReply = z.output<typeof RouteReplySchema>;

export function isRouteReply(val: unknown): val is RouteReply {
  return RouteReplySchema.safeParse(val).success;
}

export type RouteHandler = (props: {
  request: FastifyRequest;
  reply: FastifyReply;
}) => RameNode | Promise<RameNode>;

export const RoutePropsSchema = BasePropsSchema.extend({
  method: z.enum(HttpMethod),
  path: z.string(),
  schema: z.custom<FastifySchema>().optional(),
  handler: z.custom<RouteHandler>().optional(),
});
