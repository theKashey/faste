import { InternalMachine } from './internal-machine';

export type OnCallback<
  State,
  Attributes,
  AvalablePhases,
  Messages extends string,
  Signals extends string,
  Timers extends string,
  Args
> = (
  slots: InternalMachine<State, Attributes, AvalablePhases, Messages, Signals, Timers, never, never>,
  ...args: Args extends any[] ? Args : never
) => Promise<unknown> | unknown;

export type AnyOnCallback = OnCallback<any, any, any, any, any, any, []>;
