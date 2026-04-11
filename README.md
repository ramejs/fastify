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

| Package              | Version  | Notes                                                    |
| -------------------- | -------- | -------------------------------------------------------- |
| `@ramejs/rame`       | `≥0.2.0` | required                                                 |
| `fastify`            | `≥5.0.0` | required                                                 |
| `zod`                | `^4.0.0` | required                                                 |
| `@fastify/websocket` | `≥6.0.0` | optional — required when using the `Websocket` component |

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

### Middleware

Apply Fastify `preHandler` hooks to a subtree of routes without touching registration code. `Middleware` components can be nested — hooks run outer-first.

```tsx
import type { preHandlerHookHandler, preHandlerAsyncHookHandler } from 'fastify';
import { render } from '@ramejs/rame';
import { Server, RouteGroup, Route, Middleware, HttpMethod } from '@ramejs/fastify';

// Async middleware — runs before the handler, does not short-circuit
const logger: preHandlerAsyncHookHandler = async (request) => {
  console.log(`${request.method} ${request.url}`);
};

// Callback middleware — short-circuits by NOT calling done()
const requireAuth: preHandlerHookHandler = (request, reply) => {
  if (!request.headers.authorization) {
    reply.status(401).send({ error: 'Unauthorized' });
    // do not call done — terminates the lifecycle
  }
};

await render(
  <Server port={3000}>
    <RouteGroup prefix="/api">
      <Middleware use={logger}>
        <Middleware use={requireAuth}>
          <Route method={HttpMethod.GET} path="/me" handler={...} />
          <Route method={HttpMethod.DELETE} path="/account" handler={...} />
        </Middleware>
      </Middleware>
    </RouteGroup>
  </Server>,
);
```

`Middleware` only affects routes inside its subtree — sibling and parent routes are unaffected.

### WebSocket endpoints

Enable WebSocket support by adding `websocket` to `Server`, then use the `Websocket` component to register handlers. Wrap in `RouteGroup` for prefixed paths; wrap in `Middleware` to guard the upgrade.

```sh
bun add @fastify/websocket
```

```tsx
import { render } from '@ramejs/rame';
import { Server, RouteGroup, Route, Middleware, Websocket, HttpMethod } from '@ramejs/fastify';
import type { WebsocketHandler } from '@ramejs/fastify';
import type { preHandlerHookHandler } from 'fastify';

const requireAuth: preHandlerHookHandler = (request, reply) => {
  if (!request.headers.authorization) {
    reply.status(401).send({ error: 'Unauthorized' });
    // omit done() to short-circuit
  }
};

const echo: WebsocketHandler = (socket) => {
  socket.on('message', (msg) => socket.send(`echo: ${msg.toString()}`));
};

await render(
  <Server port={3000} websocket>
    <RouteGroup prefix="/api">
      {/* Regular HTTP routes coexist with WS routes */}
      <Route method={HttpMethod.GET} path="/health" handler={() => ({ ok: true })} />

      {/* WS route guarded by auth middleware */}
      <Middleware use={requireAuth}>
        <Websocket path="/events" handler={echo} />
      </Middleware>
    </RouteGroup>
  </Server>,
);

// GET  /api/health   →  200  { "ok": true }
// WS   /api/events   →  echoes every message back (requires Authorization header)
```

---

## API reference

### `Server`

Creates a Fastify instance, renders the child tree (registering all routes), then starts listening.

| Prop             | Type                                           | Default     | Description                                                               |
| ---------------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `port`           | `number`                                       | `3000`      | TCP port to listen on                                                     |
| `host`           | `string`                                       | `'0.0.0.0'` | Interface to bind                                                         |
| `listen`         | `boolean`                                      | `true`      | Set `false` to skip listening (tests)                                     |
| `fastifyOptions` | `FastifyServerOptions`                         | `{}`        | Passed directly to `fastify()`                                            |
| `listenOptions`  | `Omit<FastifyListenOptions, 'host' \| 'port'>` | `{}`        | Extra options forwarded to `app.listen()`                                 |
| `onSignal`       | `() => void`                                   | —           | Called on `SIGTERM`/`SIGINT` (default: `fastify.close()`)                 |
| `websocket`      | `boolean`                                      | `false`     | Register `@fastify/websocket` plugin (required for `Websocket` component) |

When `listen={false}`, the `FastifyInstance` is available via `ServerContext` without starting the server. This is the recommended approach for integration tests.

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

### `Middleware`

Applies a Fastify `preHandler` hook to every `Route` inside its subtree. Nesting is supported — hooks run in outer-first order.

| Prop  | Type                | Required | Description                        |
| ----- | ------------------- | -------- | ---------------------------------- |
| `use` | `MiddlewareHandler` | yes      | A Fastify preHandler hook function |

`MiddlewareHandler` is `preHandlerHookHandler | preHandlerAsyncHookHandler` from `'fastify'`.

**Short-circuiting**: use callback style (`preHandlerHookHandler`) and omit the `done()` call — Fastify will stop the lifecycle when the reply is sent without `done` being called.

---

### `Websocket`

Registers a WebSocket endpoint. Requires `websocket={true}` on the enclosing `Server`.

Install the optional peer dependency first:

```sh
bun add @fastify/websocket
```

| Prop      | Type               | Required | Description                                                |
| --------- | ------------------ | -------- | ---------------------------------------------------------- |
| `path`    | `string`           | yes      | URL path (appended to any parent group prefix)             |
| `handler` | `WebsocketHandler` | yes      | Receives `(socket: SocketStream, request: FastifyRequest)` |

`WebsocketHandler` is re-exported from `@fastify/websocket` for convenience.

```tsx
import type { WebsocketHandler } from '@ramejs/fastify';

const echo: WebsocketHandler = (socket) => {
  socket.on('message', (msg) => socket.send(msg.toString()));
};

<Websocket path="/echo" handler={echo} />;
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

Set `listen={false}` and capture the `FastifyInstance` via `ServerContext`. Use Fastify's built-in `inject` for HTTP simulation — no network required.

```tsx
import { render } from '@ramejs/rame';
import type { FastifyInstance } from 'fastify';
import { Server, ServerContext, Route, HttpMethod } from '@ramejs/fastify';

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

console.log(res.statusCode); // 200
console.log(res.json()); // { pong: true }
```

---

## License

MIT
