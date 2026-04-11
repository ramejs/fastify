import { defineComponent, useContext } from '@ramejs/rame';
import type { preHandlerAsyncHookHandler, preHandlerHookHandler } from 'fastify';
import { ServerContext } from '../Server/context';
import { PrefixContext } from '../RouteGroup';
import { WebsocketRegisteredContext } from './context';
import { WebsocketPropsSchema } from './schema';
import { MiddlewareContext } from '../Middleware/context';

export const Websocket = defineComponent(
  WebsocketPropsSchema,
  async (props): Promise<null> => {
    const fastify = useContext(ServerContext);
    const prefix = useContext(PrefixContext);
    const wsRegistered = useContext(WebsocketRegisteredContext);
    const middlewares = useContext(MiddlewareContext) as
      | (preHandlerHookHandler | preHandlerAsyncHookHandler)[]
      | undefined;

    if (!fastify) throw new Error('[Websocket] must be used inside a <Server>');
    if (!wsRegistered)
      throw new Error('[Websocket] requires @fastify/websocket — add websocket={true} to <Server>');

    const { path, handler } = props;

    const url =
      [prefix, path]
        .filter(Boolean)
        .map((p) => (p.startsWith('/') ? p : `/${p}`))
        .join('') || '/';

    fastify.get(
      url,
      {
        websocket: true,
        preHandler: middlewares && middlewares.length > 0 ? middlewares : undefined,
      },
      handler,
    );

    return null;
  },
  'Websocket',
);

export { WebsocketRegisteredContext } from './context';
export type { WebsocketProps } from './schema';
