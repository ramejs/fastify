import { render } from '@ramejs/rame';
import { z } from 'zod';
import { Server, Route, ErrorBoundary, HttpMethod } from '../src';

const Explode = () => {
  throw new Error('service down');
};

await render(
  <Server port={3000}>
    <Route method={HttpMethod.GET} path="/default-error">
      <ErrorBoundary>
        <Explode />
      </ErrorBoundary>
    </Route>

    <Route method={HttpMethod.GET} path="/custom-error">
      <ErrorBoundary
        transformError={z.instanceof(Error).transform((error) => ({
          status: 503,
          body: { message: error.message },
        }))}
      >
        <Explode />
      </ErrorBoundary>
    </Route>
  </Server>,
);

// GET /default-error → 500 { error: 'Internal Server Error' }
// GET /custom-error  → 503 { message: 'service down' }
