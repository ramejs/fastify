import { z } from 'zod';
import { defineComponent, renderToValue } from '@ramejs/rame';
import { ErrorBoundaryPropsSchema } from './schema';
import type { RouteReply } from '../Route/schema';

const defaultTransformError: z.ZodType<RouteReply> = z
  .unknown()
  .transform((): RouteReply => ({ status: 500, body: { error: 'Internal Server Error' } }));

export const ErrorBoundary = defineComponent(
  ErrorBoundaryPropsSchema,
  async (props) => {
    const { children, transformError = defaultTransformError } = props;
    try {
      return await renderToValue(children);
    } catch (err) {
      return transformError.parse(err);
    }
  },
  'ErrorBoundary',
);

export type { ErrorBoundaryProps } from './schema';
