import { z } from 'zod';
import { BasePropsSchema } from '@ramejs/rame';
import type { RouteReply } from '../Route/schema';

export const ErrorBoundaryPropsSchema = BasePropsSchema.extend({
  transformError: z.custom<z.ZodType<RouteReply>>().optional(),
});

export type ErrorBoundaryProps = z.input<typeof ErrorBoundaryPropsSchema>;
