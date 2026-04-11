import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';

export const ServerContext: RameContext<FastifyInstance | null> =
  createContext<FastifyInstance | null>(null);
