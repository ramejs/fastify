import { render } from '@ramejs/rame';
import { Server, Route, HttpMethod } from '../src';

const Healthcheck = () => ({ ok: true, service: 'api' });

await render(
  <Server port={3000} host="0.0.0.0">
    <Route method={HttpMethod.GET} path="/health">
      <Healthcheck />
    </Route>
  </Server>,
);

// Server listening on http://0.0.0.0:3000
//
// GET /health → { "ok": true, "service": "api" }
