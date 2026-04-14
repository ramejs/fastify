import { render, Fragment, useContext } from '@ramejs/rame';
import { Server, Route, RouteGroup, Middleware, HttpMethod, RequestContext } from '../src';
import type { preHandlerHookHandler } from 'fastify';

const users = new Map<string, { id: string; name: string; email: string }>([
  ['u_1', { id: 'u_1', name: 'Ada Lovelace', email: 'ada@example.com' }],
  ['u_2', { id: 'u_2', name: 'Grace Hopper', email: 'grace@example.com' }],
  ['u_3', { id: 'u_3', name: 'Margaret Hamilton', email: 'margaret@example.com' }],
]);

const teams = new Map<string, { id: string; name: string }>([
  ['t_1', { id: 't_1', name: 'Platform' }],
  ['t_2', { id: 't_2', name: 'Infrastructure' }],
]);

const requireAuth: preHandlerHookHandler = (request, reply, done) => {
  if (!request.headers.authorization) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
};

const ListUsers = () => {
  const { request } = useContext(RequestContext)!;
  const query = request.query as { page?: string; limit?: string };
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);

  const all = [...users.values()];
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);

  return {
    data: items,
    meta: { page, limit, total: all.length },
  };
};

const GetUser = () => {
  const { request } = useContext(RequestContext)!;
  const params = request.params as { id: string };
  const user = users.get(params.id);
  if (!user) return { status: 404, body: { error: 'Not found' } };
  return user;
};

const CreateUser = () => {
  const { request } = useContext(RequestContext)!;
  const { name, email } = request.body as { name: string; email: string };
  const id = `u_${users.size + 1}`;
  const user = { id, name, email };
  users.set(id, user);
  return { status: 201, body: user };
};

const UpdateUser = () => {
  const { request } = useContext(RequestContext)!;
  const params = request.params as { id: string };
  const existing = users.get(params.id);
  if (!existing) return { status: 404, body: { error: 'Not found' } };

  const patch = request.body as Partial<{ name: string; email: string }>;
  const updated = { ...existing, ...patch };
  users.set(existing.id, updated);
  return updated;
};

const DeleteUser = () => {
  const { request } = useContext(RequestContext)!;
  const params = request.params as { id: string };
  const deleted = users.delete(params.id);
  if (!deleted) return { status: 404, body: { error: 'Not found' } };
  return { status: 204, body: null };
};

const ListTeams = () => [...teams.values()];
const CreateTeam = () => ({ status: 201, body: { id: 't_3', name: 'Developer Experience' } });
const GetTeam = () => ({ id: 't_1', name: 'Platform' });

const UserRoutes = () => (
  <Fragment>
    <Route method={HttpMethod.GET} path="/users">
      <ListUsers />
    </Route>
    <Route method={HttpMethod.POST} path="/users">
      <CreateUser />
    </Route>
    <Route method={HttpMethod.GET} path="/users/:id">
      <GetUser />
    </Route>
    <Route method={HttpMethod.PATCH} path="/users/:id">
      <UpdateUser />
    </Route>
    <Route method={HttpMethod.DELETE} path="/users/:id">
      <DeleteUser />
    </Route>
  </Fragment>
);

const TeamRoutes = () => (
  <Fragment>
    <Route method={HttpMethod.GET} path="/teams">
      <ListTeams />
    </Route>
    <Route method={HttpMethod.POST} path="/teams">
      <CreateTeam />
    </Route>
    <Route method={HttpMethod.GET} path="/teams/:id">
      <GetTeam />
    </Route>
  </Fragment>
);

await render(
  <Server port={3000}>
    <RouteGroup prefix="/api">
      <Route method={HttpMethod.GET} path="/version" handler={() => ({ version: '1.0.0' })} />

      <RouteGroup prefix="/v1">
        <Middleware use={requireAuth}>
          <UserRoutes />
          <TeamRoutes />
        </Middleware>
      </RouteGroup>
    </RouteGroup>
  </Server>,
);

// GET    /api/version
// GET    /api/v1/users?page=1&limit=20
// POST   /api/v1/users
// GET    /api/v1/users/:id
// PATCH  /api/v1/users/:id
// DELETE /api/v1/users/:id
// GET    /api/v1/teams
