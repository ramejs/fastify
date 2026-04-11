import { defineComponent, useContext, renderToValue } from '@ramejs/rame';
import type { z } from 'zod';
import { ServerContext } from '../Server/context';
import { PrefixContext } from '../RouteGroup';
import { RequestContext } from './context';
import { RoutePropsSchema, isRouteReply } from './schema';

export type RouteProps = z.input<typeof RoutePropsSchema>;

export const Route = defineComponent(
  RoutePropsSchema,
  async (props): Promise<null> => {
    const fastify = useContext(ServerContext);
    const prefix = useContext(PrefixContext);

    if (!fastify) throw new Error('[Route] must be used inside a <Server>');

    const { method, path, schema, handler, children } = props;

    fastify.route({
      method,
      url:
        [prefix, path]
          .filter(Boolean)
          .map((p) => (p.startsWith('/') ? p : `/${p}`))
          .join('') || '/',
      schema,
      handler: async (request, reply) => {
        const result = handler
          ? await renderToValue(await handler({ request, reply }))
          : await renderToValue(
              await RequestContext.Provider({ value: { request, reply }, children }),
            );

        // TODO: Try to get rid of this
        if (isRouteReply(result)) {
          return reply.status(result.status).send(result.body);
        }

        return reply.send(result);
      },
    });

    return null;
  },
  'Route',
);

export { RequestContext } from './context';
export type { RequestContextValue } from './context';
export type { RouteHandler, RouteReply } from './schema';
