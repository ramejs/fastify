import { describe, it, expect } from 'bun:test';
import { renderToValue } from '@ramejs/rame';
import type { FastifyInstance, preHandlerAsyncHookHandler, preHandlerHookHandler } from 'fastify';
import { Server, Route, RouteGroup, Middleware, HttpMethod } from '../index';

async function buildApp(
  children: Parameters<typeof Server>[0]['children'],
): Promise<FastifyInstance> {
  const instance = await renderToValue(<Server listen={false}>{children}</Server>);
  return instance as FastifyInstance;
}

describe('Middleware — basic', () => {
  it('passes request through when middleware does not reply', async () => {
    const log: string[] = [];
    const logger: preHandlerAsyncHookHandler = async () => {
      log.push('before');
    };

    const app = await buildApp(
      <Middleware use={logger}>
        <Route method={HttpMethod.GET} path="/ping" handler={() => ({ pong: true })} />
      </Middleware>,
    );

    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pong: true });
    expect(log).toEqual(['before']);
  });

  it('middleware can short-circuit with a reply (callback style)', async () => {
    // In Fastify, not calling done() from a callback-style preHandler terminates the lifecycle
    const guard: preHandlerHookHandler = (_request, reply) => {
      reply.status(401).send({ error: 'Unauthorized' });
    };

    const app = await buildApp(
      <Middleware use={guard}>
        <Route method={HttpMethod.GET} path="/secret" handler={() => ({ secret: true })} />
      </Middleware>,
    );

    const res = await app.inject({ method: 'GET', url: '/secret' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('middleware only applies to routes inside its subtree', async () => {
    const log: string[] = [];
    const logger: preHandlerAsyncHookHandler = async () => {
      log.push('hit');
    };

    const app = await buildApp(
      <>
        <Middleware use={logger}>
          <Route method={HttpMethod.GET} path="/inside" handler={() => ({ in: true })} />
        </Middleware>
        <Route method={HttpMethod.GET} path="/outside" handler={() => ({ out: true })} />
      </>,
    );

    await app.inject({ method: 'GET', url: '/outside' });
    expect(log).toEqual([]);

    await app.inject({ method: 'GET', url: '/inside' });
    expect(log).toEqual(['hit']);
  });
});

describe('Middleware — nesting', () => {
  it('nested middleware handlers run in order (outer first)', async () => {
    const order: string[] = [];
    const outer: preHandlerAsyncHookHandler = async () => {
      order.push('outer');
    };
    const inner: preHandlerAsyncHookHandler = async () => {
      order.push('inner');
    };

    const app = await buildApp(
      <Middleware use={outer}>
        <Middleware use={inner}>
          <Route method={HttpMethod.GET} path="/nested" handler={() => ({ ok: true })} />
        </Middleware>
      </Middleware>,
    );

    const res = await app.inject({ method: 'GET', url: '/nested' });
    expect(res.statusCode).toBe(200);
    expect(order).toEqual(['outer', 'inner']);
  });

  it('sibling Middleware blocks are independent', async () => {
    const authLog: string[] = [];
    const logLog: string[] = [];

    const auth: preHandlerAsyncHookHandler = async () => {
      authLog.push('auth');
    };
    const logger: preHandlerAsyncHookHandler = async () => {
      logLog.push('log');
    };

    const app = await buildApp(
      <>
        <Middleware use={auth}>
          <Route method={HttpMethod.GET} path="/a" handler={() => ({ a: true })} />
        </Middleware>
        <Middleware use={logger}>
          <Route method={HttpMethod.GET} path="/b" handler={() => ({ b: true })} />
        </Middleware>
      </>,
    );

    await app.inject({ method: 'GET', url: '/a' });
    expect(authLog).toEqual(['auth']);
    expect(logLog).toEqual([]);

    await app.inject({ method: 'GET', url: '/b' });
    expect(logLog).toEqual(['log']);
    expect(authLog).toEqual(['auth']); // unchanged
  });
});

describe('Middleware — with RouteGroup', () => {
  it('applies to all routes under a group', async () => {
    const log: string[] = [];
    const logger: preHandlerAsyncHookHandler = async (req) => {
      log.push(req.url);
    };

    const app = await buildApp(
      <RouteGroup prefix="/api">
        <Middleware use={logger}>
          <Route method={HttpMethod.GET} path="/users" handler={() => []} />
          <Route method={HttpMethod.GET} path="/teams" handler={() => []} />
        </Middleware>
      </RouteGroup>,
    );

    await app.inject({ method: 'GET', url: '/api/users' });
    await app.inject({ method: 'GET', url: '/api/teams' });
    expect(log).toEqual(['/api/users', '/api/teams']);
  });
});
