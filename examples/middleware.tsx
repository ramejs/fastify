import { render, createContext, useContext } from '@ramejs/rame';
import { Server, Route, RouteGroup, Middleware, HttpMethod } from '../src';
import type { preHandlerHookHandler, preHandlerAsyncHookHandler } from 'fastify';

// ── Contexts ──────────────────────────────────────────────────────────────────

const SessionContext = createContext<{ userId: string; role: 'admin' | 'user' } | null>(null);

// ── Middleware ────────────────────────────────────────────────────────────────

// Async middleware — observes the request, never short-circuits
const requestLogger: preHandlerAsyncHookHandler = async (request) => {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
};

// Callback middleware — short-circuits by NOT calling done()
const requireAuth: preHandlerHookHandler = (request, reply) => {
  const token = request.headers.authorization;
  if (!token) {
    reply.status(401).send({ error: 'Unauthorized' });
    // Omitting done() stops the Fastify lifecycle here
  }
};

// Admin-only guard
const requireAdmin: preHandlerHookHandler = (_request, reply) => {
  const session = useContext(SessionContext);
  if (session?.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden' });
  }
};

// ── Route components ──────────────────────────────────────────────────────────

const Status = () => ({ status: 'ok', uptime: process.uptime() });

const Me = () => {
  const session = useContext(SessionContext)!;
  return { id: session.userId, role: session.role };
};

const AdminDashboard = () => ({ users: 1042, requests_today: 8831 });

// ── Server ────────────────────────────────────────────────────────────────────

await render(
  <Server port={3000}>
    <RouteGroup prefix="/api">
      {/* Public — no middleware */}
      <Route method={HttpMethod.GET} path="/status">
        <Status />
      </Route>

      {/* Logged + authenticated subtree */}
      <Middleware use={requestLogger}>
        <Middleware use={requireAuth}>
          {/* Accessible to any authenticated user */}
          <Route method={HttpMethod.GET} path="/me">
            <SessionContext.Provider value={{ userId: 'u_42', role: 'admin' }}>
              <Me />
            </SessionContext.Provider>
          </Route>

          {/* Admin-only — extra guard layered on top */}
          <Middleware use={requireAdmin}>
            <Route method={HttpMethod.GET} path="/admin/dashboard">
              <SessionContext.Provider value={{ userId: 'u_42', role: 'admin' }}>
                <AdminDashboard />
              </SessionContext.Provider>
            </Route>
          </Middleware>
        </Middleware>
      </Middleware>
    </RouteGroup>
  </Server>,
);

// Registered routes:
//   GET /api/status          → public
//   GET /api/me              → requires Authorization header
//   GET /api/admin/dashboard → requires Authorization header + admin role
//
// Middleware execution order for /api/admin/dashboard:
//   1. requestLogger (logs the request)
//   2. requireAuth   (checks Authorization header)
//   3. requireAdmin  (checks role is 'admin')
//   4. AdminDashboard component
