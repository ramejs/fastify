import { describe, it, expect } from 'bun:test';
import { renderToValue, defineComponent } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Server, Route, ErrorBoundary, HttpMethod } from '../index';

async function buildApp(
  children: Parameters<typeof Server>[0]['children'],
): Promise<FastifyInstance> {
  const instance = await renderToValue(<Server listen={false}>{children}</Server>);
  return instance as FastifyInstance;
}

const Throw = defineComponent(z.object({ message: z.string().default('boom') }), ({ message }) => {
  throw new Error(message);
});

const Ok = defineComponent(z.object({}), () => ({ ok: true }));

describe('ErrorBoundary — default error handler', () => {
  it('passes through the result when no error is thrown', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/ok">
        <ErrorBoundary>
          <Ok />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/ok' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('returns 500 with default body when child throws', async () => {
    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/explode">
        <ErrorBoundary>
          <Throw />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/explode' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Internal Server Error' });
  });

  it('returns 500 for async throwing child', async () => {
    const AsyncThrow = defineComponent(z.object({}), async () => {
      await Promise.resolve();
      throw new Error('async boom');
    });

    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/async-throw">
        <ErrorBoundary>
          <AsyncThrow />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/async-throw' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'Internal Server Error' });
  });
});

describe('ErrorBoundary — custom transformError', () => {
  it('uses transformError to shape the error response', async () => {
    const transform = z
      .instanceof(Error)
      .transform((err) => ({ status: 503, body: { message: err.message } }));

    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/custom">
        <ErrorBoundary transformError={transform}>
          <Throw message="service down" />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/custom' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ message: 'service down' });
  });

  it('does not invoke transformError when no error is thrown', async () => {
    let transformCalled = false;
    const transform = z.unknown().transform((err) => {
      transformCalled = true;
      return { status: 500, body: { error: String(err) } };
    });

    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/no-error">
        <ErrorBoundary transformError={transform}>
          <Ok />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/no-error' });
    expect(res.statusCode).toBe(200);
    expect(transformCalled).toBe(false);
  });

  it('custom status code is forwarded to the HTTP response', async () => {
    const transform = z
      .unknown()
      .transform(() => ({ status: 422, body: { error: 'Unprocessable' } }));

    const app = await buildApp(
      <Route method={HttpMethod.GET} path="/unprocessable">
        <ErrorBoundary transformError={transform}>
          <Throw />
        </ErrorBoundary>
      </Route>,
    );
    const res = await app.inject({ method: 'GET', url: '/unprocessable' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'Unprocessable' });
  });
});
