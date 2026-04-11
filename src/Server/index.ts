import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { defineComponent, render } from '@ramejs/rame';
import { ServerContext } from './context';
import { ServerPropsSchema } from './schema';
import { PrefixContext } from '../RouteGroup';
import { WebsocketRegisteredContext } from '../Websocket/context';

export const Server = defineComponent(
  ServerPropsSchema,
  async (props): Promise<FastifyInstance | null> => {
    const { host, port, listen, fastifyOptions, listenOptions, onSignal, websocket, children } =
      props;
    const fastify = Fastify(fastifyOptions);

    if (websocket) {
      const { default: wsPlugin } = await import('@fastify/websocket');
      await fastify.register(wsPlugin);
    }

    await render(
      ServerContext.Provider({
        value: fastify,
        children: WebsocketRegisteredContext.Provider({
          value: websocket ?? false,
          children: PrefixContext.Provider({ value: '', children }),
        }),
      }),
    );

    if (!listen) {
      return fastify;
    }

    await fastify.listen({ host, port, ...listenOptions });

    const signalHandler = onSignal ?? ((): void => void fastify.close());
    process.once('SIGTERM', signalHandler);
    process.once('SIGINT', signalHandler);

    return null;
  },
  'Server',
);

export { ServerContext } from './context';
export type { ServerProps } from './schema';
