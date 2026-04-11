import { defineComponent, useContext } from '@ramejs/rame';
import type { z } from 'zod';
import { PrefixContext } from './context';
import { RouteGroupPropsSchema } from './schema';

export type RouteGroupProps = z.input<typeof RouteGroupPropsSchema>;

export const RouteGroup = defineComponent(
  RouteGroupPropsSchema,
  (props) => {
    const currentPrefix = useContext(PrefixContext);
    return PrefixContext.Provider({
      value:
        [currentPrefix, props.prefix]
          .filter(Boolean)
          .map((p) => (p.startsWith('/') ? p : `/${p}`))
          .join('') || '/',
      children: props.children,
    });
  },
  'RouteGroup',
);

export { PrefixContext } from './context';
