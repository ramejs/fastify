import { describe, it, expect } from 'bun:test';
import { render } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import {
  Server,
  Route,
  RouteGroup,
  Middleware,
  Websocket,
  ServerContext,
  HttpMethod,
} from '../index';
import type { preHandlerHookHandler } from 'fastify';
import WebSocket from 'ws';

describe('Server', () => {
  it('Consumer receives the Fastify instance', async () => {
    let app: FastifyInstance | null = null;

    await render(
      <Server listen={false}>
        <ServerContext.Consumer>
          {(instance) => {
            app = instance;
            return null;
          }}
        </ServerContext.Consumer>
      </Server>,
    );

    expect(app).not.toBeNull();
  });

  it('ServerContext is null outside a Server', async () => {
    let app: FastifyInstance | null = undefined as unknown as null;

    await render(
      <ServerContext.Consumer>
        {(instance) => {
          app = instance;
          return null;
        }}
      </ServerContext.Consumer>,
    );

    expect(app).toBeNull();
  });

  it('routes registered in the tree are accessible via the captured instance', async () => {
    let app: FastifyInstance | null = null;

    await render(
      <Server listen={false}>
        <ServerContext.Consumer>
          {(instance) => {
            app = instance;
            return null;
          }}
        </ServerContext.Consumer>
        <Route method={HttpMethod.GET} path="/ping" handler={() => ({ pong: true })} />
      </Server>,
    );

    const res = await app!.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pong: true });
  });

  it('RouteReply envelope is respected', async () => {
    let app: FastifyInstance | null = null;

    await render(
      <Server listen={false}>
        <ServerContext.Consumer>
          {(instance) => {
            app = instance;
            return null;
          }}
        </ServerContext.Consumer>
        <Route
          method={HttpMethod.GET}
          path="/secret"
          handler={() => ({ status: 403, body: { error: 'Forbidden' } })}
        />
      </Server>,
    );

    const res = await app!.inject({ method: 'GET', url: '/secret' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('RouteGroup prefix is applied', async () => {
    let app: FastifyInstance | null = null;

    await render(
      <Server listen={false}>
        <ServerContext.Consumer>
          {(instance) => {
            app = instance;
            return null;
          }}
        </ServerContext.Consumer>
        <RouteGroup prefix="/api">
          <Route method={HttpMethod.GET} path="/users" handler={() => ({ users: [] })} />
        </RouteGroup>
      </Server>,
    );

    const res = await app!.inject({ method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ users: [] });
  });
});

describe('Server - Websockets', () => {
  async function buildWsApp(
    children: Parameters<typeof Server>[0]['children'],
  ): Promise<FastifyInstance> {
    let app: FastifyInstance | null = null;
    await render(
      <Server listen={false} websocket>
        <ServerContext.Consumer>
          {(instance) => {
            app = instance;
            return null;
          }}
        </ServerContext.Consumer>
        {children}
      </Server>,
    );
    return app!;
  }

  function connectWs(app: FastifyInstance, path: string, send?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      app.listen({ port: 0 }, (err) => {
        if (err) return reject(err);
        const addr = app.server.address() as { port: number };
        const ws = new WebSocket(`ws://localhost:${addr.port}${path}`);
        const messages: string[] = [];
        ws.on('message', (data) => messages.push(data.toString()));
        ws.on('open', () => {
          if (send !== undefined) ws.send(send);
        });
        ws.on('close', () => {
          app.close();
          resolve(messages);
        });
        ws.on('error', (e) => {
          app.close();
          reject(e);
        });
        setTimeout(() => ws.close(), 300);
      });
    });
  }

  // ── WebSocket test suites ──────────────────────────────────────────────────────

  describe('Server — websocket: prop enables WS support', () => {
    it('Server with websocket={true} accepts WS connections', async () => {
      const app = await buildWsApp(
        <Websocket
          path="/ws"
          handler={(socket) => {
            socket.send('hello');
          }}
        />,
      );
      const messages = await connectWs(app, '/ws');
      expect(messages).toContain('hello');
    });

    it('Server without websocket prop rejects Websocket component', async () => {
      await expect(
        (async () => {
          await render(
            <Server listen={false}>
              <Websocket path="/ws" handler={() => {}} />
            </Server>,
          );
        })(),
      ).rejects.toThrow('@fastify/websocket');
    });
  });

  describe('Server — websocket: REST and WS routes coexist', () => {
    it('HTTP routes remain accessible alongside WS routes', async () => {
      const app = await buildWsApp(
        <>
          <Route method={HttpMethod.GET} path="/health" handler={() => ({ ok: true })} />
          <Websocket path="/ws" handler={() => {}} />
        </>,
      );

      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ ok: true });
    });
  });

  describe('Server — websocket: RouteGroup prefix applies to Websocket', () => {
    it('WS route is registered under the group prefix', async () => {
      const app = await buildWsApp(
        <RouteGroup prefix="/api">
          <Websocket
            path="/events"
            handler={(socket) => {
              socket.send('event');
            }}
          />
        </RouteGroup>,
      );
      const messages = await connectWs(app, '/api/events');
      expect(messages).toContain('event');
    });
  });

  describe('Server — websocket: Middleware runs before WS connection', () => {
    it('middleware can short-circuit a WS upgrade', async () => {
      let touched = false;
      const guard: preHandlerHookHandler = (_req, reply) => {
        touched = true;
        reply.status(403).send({ error: 'Forbidden' });
      };

      const app = await buildWsApp(
        <Middleware use={guard}>
          <Websocket path="/ws" handler={() => {}} />
        </Middleware>,
      );

      // HTTP GET to the WS endpoint is rejected by the preHandler before upgrade
      const res = await app.inject({ method: 'GET', url: '/ws' });
      expect(touched).toBe(true);
      expect(res.statusCode).toBe(403);
    });
  });
});
