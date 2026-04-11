import { describe, it, expect } from 'bun:test';
import { renderToValue, defineComponent, useContext } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Server, Route, RequestContext, HttpMethod } from '../index';

async function buildApp(
  children: Parameters<typeof Server>[0]['children'],
): Promise<FastifyInstance> {
  const instance = await renderToValue(<Server listen={false}>{children}</Server>);
  return instance as FastifyInstance;
}

describe('Route — handler function', () => {
  it('GET returns plain object as JSON', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/hello" handler={() => ({ message: 'hello' })} />,
    );
    const res = await app.inject({ method: 'GET', url: '/hello' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: 'hello' });
  });

  it('POST returns plain object as JSON', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.POST} path="/items" handler={() => ({ id: 1 })} />,
    );
    const res = await app.inject({ method: 'POST', url: '/items' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 1 });
  });

  it('async handler resolves before sending', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.GET}
        path="/async"
        handler={async () => {
          await Promise.resolve();
          return { async: true };
        }}
      />,
    );
    const res = await app.inject({ method: 'GET', url: '/async' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ async: true });
  });

  it('handler can return RouteReply to set custom status', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.GET}
        path="/forbidden"
        handler={() => ({ status: 403, body: { error: 'Forbidden' } })}
      />,
    );
    const res = await app.inject({ method: 'GET', url: '/forbidden' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'Forbidden' });
  });

  it('RouteReply with 201 status', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.POST}
        path="/created"
        handler={() => ({ status: 201, body: { id: 42 } })}
      />,
    );
    const res = await app.inject({ method: 'POST', url: '/created' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: 42 });
  });

  it('plain object with a status field is sent as-is', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/status-field" handler={() => ({ status: 'active' })} />,
    );
    const res = await app.inject({ method: 'GET', url: '/status-field' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'active' });
  });
});

describe('Route — children with RequestContext', () => {
  const EchoUrl = defineComponent(z.object({}), () => {
    const ctx = useContext(RequestContext);
    return { url: ctx?.request.url };
  });

  it('children receive RequestContext with request data', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/echo">
        <EchoUrl />
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/echo' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ url: '/echo' });
  });

  it('children can return RouteReply envelope', async () => {
    const Guard = defineComponent(z.object({}), () => ({
      status: 401,
      body: { error: 'Unauthorized' },
    }));

    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/guarded">
        <Guard />
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/guarded' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized' });
  });
});

describe('Route — unregistered paths', () => {
  it('request to unknown path returns 404', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/exists" handler={() => ({ ok: true })} />,
    );
    const res = await app.inject({ method: 'GET', url: '/not-exists' });
    expect(res.statusCode).toBe(404);
  });
});

describe('Route — schema validation', () => {
  it('rejects request with invalid body (missing required field)', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.POST}
        path="/users"
        schema={{
          body: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        }}
        handler={({ request }) => request.body as Record<string, string>}
      />,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Alice' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts request with valid body', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.POST}
        path="/users"
        schema={{
          body: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        }}
        handler={({ request }) => request.body as Record<string, string>}
      />,
    );
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Alice', email: 'alice@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
  });

  it('response schema strips extra fields from output', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.GET}
        path="/profile"
        schema={{
          response: {
            200: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
              },
            },
          },
        }}
        handler={() => ({ id: 1, name: 'Alice', secret: 'hidden' })}
      />,
    );
    const res = await app.inject({ method: 'GET', url: '/profile' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ id: 1, name: 'Alice' });
    expect(body.secret).toBeUndefined();
  });

  it('rejects request with invalid querystring', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.GET}
        path="/search"
        schema={{
          querystring: {
            type: 'object',
            required: ['q'],
            properties: {
              q: { type: 'string' },
            },
          },
        }}
        handler={({ request }) => ({ q: (request.query as { q: string }).q })}
      />,
    );
    const res = await app.inject({ method: 'GET', url: '/search' });
    expect(res.statusCode).toBe(400);
  });

  it('accepts request with valid querystring', async () => {
    const app = await buildApp(
      <Route
        method={HttpMethod.GET}
        path="/search"
        schema={{
          querystring: {
            type: 'object',
            required: ['q'],
            properties: {
              q: { type: 'string' },
            },
          },
        }}
        handler={({ request }) => ({ q: (request.query as { q: string }).q })}
      />,
    );
    const res = await app.inject({ method: 'GET', url: '/search?q=hello' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ q: 'hello' });
  });
});
