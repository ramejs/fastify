import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';
import type { preHandlerHookHandler, preHandlerAsyncHookHandler } from 'fastify';

export type MiddlewareHandler = preHandlerHookHandler | preHandlerAsyncHookHandler;

export const MiddlewareContext: RameContext<MiddlewareHandler[]> = createContext<
  MiddlewareHandler[]
>([]);
