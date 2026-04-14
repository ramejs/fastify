import { render, useContext } from '@ramejs/rame';
import { Server, Route, HttpMethod, RequestContext } from '../src';

const WhoAmI = () => {
  const { request } = useContext(RequestContext)!;
  return { ip: request.ip, method: request.method, url: request.url };
};

await render(
  <Server port={3000}>
    <Route method={HttpMethod.GET} path="/health" handler={() => ({ ok: true })} />

    <Route
      method={HttpMethod.POST}
      path="/echo"
      handler={({ request }) => ({ echo: request.body })}
    />

    <Route method={HttpMethod.GET} path="/whoami">
      <WhoAmI />
    </Route>

    <Route
      method={HttpMethod.POST}
      path="/users"
      schema={{
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      }}
      handler={({ request }) => ({
        status: 201,
        body: {
          id: 'u_3',
          ...(request.body as { name: string; email: string }),
        },
      })}
    />
  </Server>,
);

// GET  /health  → 200 { ok: true }
// POST /echo    → 200 { echo: ... }
// GET  /whoami  → 200 { ip, method, url }
// POST /users   → 201 { id, name, email }
