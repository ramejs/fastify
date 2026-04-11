import { describe, it, expect } from 'bun:test';
import { render } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { Server, Route, RouteGroup, ServerContext, HttpMethod } from '../index';

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
