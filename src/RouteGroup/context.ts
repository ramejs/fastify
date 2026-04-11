import { createContext } from '@ramejs/rame';
import type { RameContext } from '@ramejs/rame';

export const PrefixContext: RameContext<string> = createContext<string>('');
