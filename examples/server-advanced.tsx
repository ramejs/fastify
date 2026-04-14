import { render } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { Server, ServerContext, Route, HttpMethod } from '../src';

const buildApp = async (): Promise<FastifyInstance> => {
  let app: FastifyInstance | null = null;

  await render(
    <Server listen={false} host="127.0.0.1" port={8080} fastifyOptions={{ logger: true }}>
      <ServerContext.Consumer>
        {(instance) => {
          app = instance;
          return null;
        }}
      </ServerContext.Consumer>

      <Route method={HttpMethod.GET} path="/health" handler={() => ({ ok: true })} />
      <Route method={HttpMethod.GET} path="/ready" handler={() => ({ ready: true })} />
    </Server>,
  );

  return app!;
};

const app = await buildApp();

console.log((await app.inject({ method: 'GET', url: '/health' })).json());
console.log((await app.inject({ method: 'GET', url: '/ready' })).json());

await app.close();

// This example shows two advanced patterns:
// 1. Passing Fastify options via fastifyOptions.
// 2. Using listen={false} + ServerContext.Consumer to test routes without opening a port.
