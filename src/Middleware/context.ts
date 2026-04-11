import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';
import type { FastifyRequest, FastifyReply } from 'fastify';

export type MiddlewareHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => void | Promise<void>;

export const MiddlewareContext: RameContext<MiddlewareHandler[]> = createContext<
  MiddlewareHandler[]
>([]);
