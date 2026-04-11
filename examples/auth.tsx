import { render, createContext, useContext, type RameNode } from '@ramejs/rame';
import { Server, Route, RouteGroup, HttpMethod } from '../src';

const AuthContext = createContext<{ userId: string; role: 'admin' | 'user' } | null>(null);

const RequireAuth = ({ children }: { children?: RameNode }): RameNode => {
  const session = useContext(AuthContext);

  if (!session) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  return children;
};

const Me = () => {
  const session = useContext(AuthContext)!;
  return { id: session.userId, role: session.role };
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

// GET /api/me → { "id": "u_42", "role": "admin" }
// GET /api/me (no auth) → 401 { "error": "Unauthorized" }
