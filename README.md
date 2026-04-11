# `@ramejs/fastify`

[![Discord](https://img.shields.io/discord/1492554668708986890?style=flat&logo=discord&logoColor=white&labelColor=dark)](https://discord.gg/ramejs)

> Build Fastify servers with JSX — declarative, composable, type-safe.

`@ramejs/fastify` renders a JSX component tree into a live Fastify server. Routes, groups, and middleware are components. Your server reads like intent, not plumbing.

```tsx
await render(
  <Server port={3000}>
    <RouteGroup prefix="/api/v1">
      <Route method={HttpMethod.GET} path="/users">
        <ListUsers />
      </Route>
    </RouteGroup>
  </Server>,
);
```

---

## Installation

```sh
bun add @ramejs/fastify fastify zod
bun add -d @ramejs/rame
```

> **npm / pnpm / yarn** work identically — swap `bun add` for your package manager.

Add JSX support to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@ramejs/rame"
  }
}
```

### Peer dependencies

| Package        | Version  |
| -------------- | -------- |
| `@ramejs/rame` | `≥0.2.0` |
| `fastify`      | `≥5.0.0` |
| `zod`          | `^4.0.0` |

---

## Quick start

```tsx
// server.tsx
import { render } from '@ramejs/rame';
import { Server, Route, HttpMethod } from '@ramejs/fastify';

const Healthcheck = () => ({ ok: true });

await render(
  <Server port={3000} host="0.0.0.0">
    <Route method={HttpMethod.GET} path="/health">
      <Healthcheck />
    </Route>
  </Server>,
);

// → GET /health  200  { "ok": true }
```

---

## Examples

### Nested route groups

Compose prefixes by nesting `RouteGroup`s. No plugin boilerplate required.

```tsx
import { render } from '@ramejs/rame';
import { Server, Route, RouteGroup, HttpMethod } from '@ramejs/fastify';

const ListUsers = () => [{ id: 'u_1', name: 'Ada' }];
const ListTeams = () => [{ id: 't_1', name: 'Platform' }];

await render(
  <Server port={3000}>
    <RouteGroup prefix="/api">
      <RouteGroup prefix="/v1">
        <Route method={HttpMethod.GET} path="/users">
          <ListUsers />
        </Route>
        <Route method={HttpMethod.GET} path="/teams">
          <ListTeams />
        </Route>
      </RouteGroup>
    </RouteGroup>
  </Server>,
);

// GET /api/v1/users  →  [{ "id": "u_1", "name": "Ada" }]
// GET /api/v1/teams  →  [{ "id": "t_1", "name": "Platform" }]
```

### Authentication with context

Pass request-scoped data through the tree using `@ramejs/rame` context. No globals; no prop-drilling.

```tsx
import { render, createContext, useContext, type RameNode } from '@ramejs/rame';
import { Server, Route, RouteGroup, HttpMethod } from '@ramejs/fastify';

const AuthContext = createContext<{ userId: string; role: 'admin' | 'user' } | null>(null);

// Guard component — returns 401 if no session in context
const RequireAuth = ({ children }: { children?: RameNode }): RameNode => {
  const session = useContext(AuthContext);
  if (!session) return { status: 401, body: { error: 'Unauthorized' } };
  return children;
};

// Business component — reads session from context
const Me = () => {
  const { userId, role } = useContext(AuthContext)!;
  return { id: userId, role };
};

await render(
  <Server port={3000}>
    <RouteGroup prefix="/api">
      <Route method={HttpMethod.GET} path="/me">
        <AuthContext.Provider value={{ userId: 'u_42', role: 'admin' }}>
          <RequireAuth>
            <Me />
          </RequireAuth>
        </AuthContext.Provider>
      </Route>
    </RouteGroup>
  </Server>,
);

// GET /api/me (authenticated)  →  200  { "id": "u_42", "role": "admin" }
// GET /api/me (no session)     →  401  { "error": "Unauthorized" }
```

### Inline handler

For simple endpoints, skip the component and pass a `handler` function directly.

```tsx
<Route method={HttpMethod.POST} path="/echo" handler={({ request }) => ({ echo: request.body })} />
```

---

## API reference

### `Server`

Creates a Fastify instance, renders the child tree (registering all routes), then starts listening.

| Prop             | Type                                           | Default     | Description                               |
| ---------------- | ---------------------------------------------- | ----------- | ----------------------------------------- |
| `port`           | `number`                                       | `3000`      | TCP port to listen on                     |
| `host`           | `string`                                       | `'0.0.0.0'` | Interface to bind                         |
| `listen`         | `boolean`                                      | `true`      | Set `false` to skip listening (tests)     |
| `fastifyOptions` | `FastifyServerOptions`                         | `{}`        | Passed directly to `fastify()`            |
| `listenOptions`  | `Omit<FastifyListenOptions, 'host' \| 'port'>` | `{}`        | Extra options forwarded to `app.listen()` |

When `listen={false}`, `renderToValue` returns the configured `FastifyInstance` without starting the server. This is the recommended approach for integration tests.

---

### `RouteGroup`

Scopes a subtree of routes under a shared URL prefix. Groups can be arbitrarily nested.

| Prop     | Type     | Required | Description           |
| -------- | -------- | -------- | --------------------- |
| `prefix` | `string` | yes      | URL prefix to prepend |

---

### `Route`

Registers a single HTTP endpoint.

| Prop       | Type            | Required | Description                                    |
| ---------- | --------------- | -------- | ---------------------------------------------- |
| `method`   | `HttpMethod`    | yes      | HTTP verb                                      |
| `path`     | `string`        | yes      | URL path (appended to any parent group prefix) |
| `handler`  | `RouteHandler`  | —        | Inline function handler                        |
| `schema`   | `FastifySchema` | —        | Fastify JSON Schema for request/response       |
| `children` | `RameNode`      | —        | Component subtree to render as the response    |

Provide either `handler` **or** `children`. If both are given, `handler` takes precedence.

**`handler`** signature:

```ts
type RouteHandler = (props: {
  request: FastifyRequest;
  reply: FastifyReply;
}) => RameNode | Promise<RameNode>;
```

Return a plain object to send it as JSON. Return a `RouteReply` to set an explicit status code:

```ts
handler={() => ({ status: 201, body: { id: 'new_resource' } })}
```

**`children`** are rendered with `RequestContext` in scope. Any component in the subtree can call `useContext(RequestContext)` to read `{ request, reply }`.

---

### `HttpMethod`

```ts
import { HttpMethod } from '@ramejs/fastify';

HttpMethod.GET; // 'GET'
HttpMethod.POST; // 'POST'
HttpMethod.PUT; // 'PUT'
HttpMethod.PATCH; // 'PATCH'
HttpMethod.DELETE; // 'DELETE'
HttpMethod.HEAD; // 'HEAD'
HttpMethod.OPTIONS; // 'OPTIONS'
```

---

### `RouteReply`

Return this shape from any handler or child component to control the HTTP status code explicitly.

```ts
interface RouteReply {
  status: number; // HTTP status code
  body: unknown; // Response body (serialized as JSON)
}
```

---

### `RequestContext`

A `RameContext` that holds `{ request, reply }` for the current Fastify request. Available inside any `Route` child tree.

```tsx
import { useContext } from '@ramejs/rame';
import { RequestContext } from '@ramejs/fastify';

const WhoAmI = () => {
  const { request } = useContext(RequestContext)!;
  return { ip: request.ip };
};
```

---

### `ServerContext`

A `RameContext` that exposes the `FastifyInstance` created by `Server`. Useful for components that need direct Fastify access (e.g. registering plugins inside the tree).

```tsx
import { useContext } from '@ramejs/rame';
import { ServerContext } from '@ramejs/fastify';

const RegisterPlugin = () => {
  const app = useContext(ServerContext)!;
  app.addHook('onRequest', async (req) => {
    /* ... */
  });
  return null;
};
```

---

## Testing

Set `listen={false}` to get back the configured `FastifyInstance` without binding a port. Use Fastify's built-in `inject` for HTTP simulation — no network required.

```tsx
import { renderToValue } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { Server, Route, HttpMethod } from '@ramejs/fastify';

const app = (await renderToValue(
  <Server listen={false}>
    <Route method={HttpMethod.GET} path="/ping" handler={() => ({ pong: true })} />
  </Server>,
)) as FastifyInstance;

const res = await app.inject({ method: 'GET', url: '/ping' });

console.log(res.statusCode); // 200
console.log(res.json()); // { pong: true }
```

---

## License

MIT
