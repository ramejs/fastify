import { describe, it, expect } from 'bun:test';
import { renderToValue } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { Server, Route, RouteGroup, HttpMethod } from '../index';

async function buildApp(
  children: Parameters<typeof Server>[0]['children'],
): Promise<FastifyInstance> {
  const instance = await renderToValue(<Server listen={false}>{children}</Server>);
  return instance as FastifyInstance;
}

describe('RouteGroup — prefix composition', () => {
  it('applies prefix to child route', async () => {
    const app = await buildApp(
      <RouteGroup prefix="/api">
        <Route method={HttpMethod.GET} path="/users" handler={() => ({ users: [] })} />
      </RouteGroup>,
    );
    const res = await app.inject({ method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ users: [] });
  });

  it('nested groups accumulate prefixes', async () => {
    const app = await buildApp(
      <RouteGroup prefix="/api">
        <RouteGroup prefix="/v1">
          <Route method={HttpMethod.GET} path="/ping" handler={() => ({ pong: true })} />
        </RouteGroup>
      </RouteGroup>,
    );
    const res = await app.inject({ method: 'GET', url: '/api/v1/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pong: true });
  });

  it('route without group has no extra prefix', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/raw" handler={() => ({ ok: true })} />,
    );
    const res = await app.inject({ method: 'GET', url: '/raw' });
    expect(res.statusCode).toBe(200);
  });

  it('sibling groups are independent', async () => {
    const app = await buildApp(
      <>
        <RouteGroup prefix="/a">
          <Route method={HttpMethod.GET} path="/route" handler={() => ({ group: 'a' })} />
        </RouteGroup>
        <RouteGroup prefix="/b">
          <Route method={HttpMethod.GET} path="/route" handler={() => ({ group: 'b' })} />
        </RouteGroup>
      </>,
    );
    const a = await app.inject({ method: 'GET', url: '/a/route' });
    const b = await app.inject({ method: 'GET', url: '/b/route' });
    expect(a.json()).toMatchObject({ group: 'a' });
    expect(b.json()).toMatchObject({ group: 'b' });
  });

  it('prefix without leading slash is normalised', async () => {
    const app = await buildApp(
      <RouteGroup prefix="api">
        <Route method={HttpMethod.GET} path="health" handler={() => ({ ok: true })} />
      </RouteGroup>,
    );
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('deeply nested groups combine all segments', async () => {
    const app = await buildApp(
      <RouteGroup prefix="/v2">
        <RouteGroup prefix="/users">
          <RouteGroup prefix="/admin">
            <Route method={HttpMethod.GET} path="/list" handler={() => ({ admin: true })} />
          </RouteGroup>
        </RouteGroup>
      </RouteGroup>,
    );
    const res = await app.inject({ method: 'GET', url: '/v2/users/admin/list' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ admin: true });
  });
});
