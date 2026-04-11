import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';

export const WebsocketRegisteredContext: RameContext<boolean> = createContext<boolean>(false);
