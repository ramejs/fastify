import { z } from 'zod';
import { BasePropsSchema } from '@ramejs/rame';

export const RouteGroupPropsSchema = BasePropsSchema.extend({
  prefix: z.string(),
});
