import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface RequestContextValue {
  request: FastifyRequest;
  reply: FastifyReply;
}

export const RequestContext: RameContext<RequestContextValue | null> =
  createContext<RequestContextValue | null>(null);
