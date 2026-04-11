import { defineComponent, useContext } from '@ramejs/rame';
import { MiddlewareContext } from './context';
import { MiddlewarePropsSchema } from './schema';

export const Middleware = defineComponent(
  MiddlewarePropsSchema,
  (props) => {
    const current = useContext(MiddlewareContext);
    return MiddlewareContext.Provider({
      value: [...current, props.use],
      children: props.children,
    });
  },
  'Middleware',
);

export { MiddlewareContext } from './context';
export type { MiddlewareHandler } from './context';
export type { MiddlewareProps } from './schema';
