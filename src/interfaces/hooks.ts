import { InternalMachine } from './internal-machine';

export type HookArgument<Messages extends string, State, Attributes, Timers extends string> = InternalMachine<
  State,
  Attributes,
  never,
  Messages,
  never,
  Timers,
  never,
  never
> & { message: Messages };
export type OnHookCallback<Messages extends string, State, Attributes, Timers extends string, T> = (
  arg: HookArgument<Messages, State, Attributes, Timers>
) => T;
export type OffHookCallback<Messages extends string, State, Attributes, Timers extends string, T> = (
  arg: HookArgument<Messages, State, Attributes, Timers>,
  hookInfo: T
) => void;

export type HookCallback<Messages extends string, State, Attributes, Timers extends string, T = unknown> = {
  on?: OnHookCallback<Messages, State, Attributes, Timers, T>;
  off?: OffHookCallback<Messages, State, Attributes, Timers, T>;
};

export type AnyHookCallback = HookCallback<any, any, any, any>;

export type Hooks<State, Attributes, Messages extends string, Timers extends string> = {
  [K in Messages]?: HookCallback<Messages, State, Attributes, Timers>;
};
