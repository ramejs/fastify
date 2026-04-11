import { render } from '@ramejs/rame';
import { Server, Route, RouteGroup, HttpMethod } from '../src';

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

// Registered routes:
//   GET /api/v1/users → [{ "id": "u_1", "name": "Ada" }]
//   GET /api/v1/teams → [{ "id": "t_1", "name": "Platform" }]
