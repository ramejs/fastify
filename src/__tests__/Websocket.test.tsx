import { describe, it, expect } from 'bun:test';
import { renderToValue } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { Server, RouteGroup, Middleware, Websocket, HttpMethod, Route } from '../index';
import type { preHandlerAsyncHookHandler } from 'fastify';

async function buildApp(
  children: Parameters<typeof Server>[0]['children'],
  websocket = true,
): Promise<FastifyInstance> {
  const instance = await renderToValue(
    <Server listen={false} websocket={websocket}>
      {children}
    </Server>,
  );
  return instance as FastifyInstance;
}

// Helper: open a real WS connection and collect messages, then close
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

      // Auto-close after brief silence
      setTimeout(() => ws.close(), 300);
    });
  });
}

describe('Websocket — registration', () => {
  it('throws when used without websocket={true} on Server', async () => {
    expect(buildApp(<Websocket path="/ws" handler={() => {}} />, false)).rejects.toThrow(
      '@fastify/websocket',
    );
  });

  it('throws when used outside a <Server>', async () => {
    expect(renderToValue(<Websocket path="/ws" handler={() => {}} />)).rejects.toThrow('<Server>');
  });

  it('registers a websocket route under the correct path', async () => {
    const app = await buildApp(<Websocket path="/ws" handler={() => {}} />);
    const routes = app.printRoutes();
    expect(routes).toContain('ws');
  });

  it('respects RouteGroup prefix', async () => {
    const app = await buildApp(
      <RouteGroup prefix="/api">
        <Websocket path="/events" handler={() => {}} />
      </RouteGroup>,
    );
    const routes = app.printRoutes();
    expect(routes).toContain('api/events');
  });
});

describe('Websocket — messaging', () => {
  it('handler receives socket and can send messages', async () => {
    const app = await buildApp(
      <Websocket
        path="/echo"
        handler={(socket) => {
          socket.on('message', (msg) => socket.send(`echo:${msg.toString()}`));
        }}
      />,
    );

    const messages = await connectWs(app, '/echo', 'hello');
    expect(messages).toContain('echo:hello');
  });

  it('handler receives the FastifyRequest', async () => {
    const received: string[] = [];

    const app = await buildApp(
      <Websocket
        path="/req"
        handler={(_socket, req) => {
          received.push(req.url);
        }}
      />,
    );

    await connectWs(app, '/req');
    expect(received[0]).toBe('/req');
  });

  it('can broadcast to multiple messages', async () => {
    const app = await buildApp(
      <Websocket
        path="/counter"
        handler={(socket) => {
          let count = 0;
          socket.on('message', () => {
            count++;
            socket.send(String(count));
          });
        }}
      />,
    );

    return new Promise<void>((resolve, reject) => {
      app.listen({ port: 0 }, (err) => {
        if (err) return reject(err);
        const addr = app.server.address() as { port: number };
        const ws = new WebSocket(`ws://localhost:${addr.port}/counter`);
        const messages: string[] = [];

        ws.on('message', (d) => messages.push(d.toString()));
        ws.on('open', () => {
          ws.send('a');
          ws.send('b');
          ws.send('c');
          setTimeout(() => {
            ws.close();
            app.close();
            expect(messages).toEqual(['1', '2', '3']);
            resolve();
          }, 200);
        });
        ws.on('error', (e) => {
          app.close();
          reject(e);
        });
      });
    });
  });
});

describe('Websocket — with Middleware', () => {
  it('preHandler middleware runs before the websocket connection is accepted', async () => {
    const log: string[] = [];
    const logger: preHandlerAsyncHookHandler = async (req) => {
      log.push(req.url);
    };

    const app = await buildApp(
      <Middleware use={logger}>
        <Websocket path="/ws" handler={() => {}} />
      </Middleware>,
    );

    await connectWs(app, '/ws');
    expect(log).toContain('/ws');
  });
});

describe('Websocket — coexistence with Route', () => {
  it('HTTP routes and Websocket routes coexist on the same server', async () => {
    const app = await buildApp(
      <>
        <Route method={HttpMethod.GET} path="/health" handler={() => ({ ok: true })} />
        <Websocket path="/ws" handler={() => {}} />
      </>,
    );

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });

    const routes = app.printRoutes();
    expect(routes).toContain('ws');
  });
});
