import { z } from 'zod';
import { BasePropsSchema } from '@ramejs/rame';
import type { MiddlewareHandler } from './context';

export const MiddlewarePropsSchema = BasePropsSchema.extend({
  use: z.custom<MiddlewareHandler>(),
});

export type MiddlewareProps = z.input<typeof MiddlewarePropsSchema>;
