import { InternalMachine } from './internal-machine';
import { CallSignature } from './signatures';

export type HookArgument<
  Messages extends string,
  State,
  Attributes,
  Timers extends string,
  MessageSignatures extends CallSignature<Messages>
> = InternalMachine<State, Attributes, never, Messages, never, Timers, MessageSignatures, never> & {
  message: Messages;
};
export type OnHookCallback<
  Messages extends string,
  State,
  Attributes,
  Timers extends string,
  MessageSignatures extends CallSignature<Messages>
> = (
  arg: HookArgument<Messages, State, Attributes, Timers, MessageSignatures>
) => void | ((arg: HookArgument<Messages, State, Attributes, Timers, MessageSignatures>) => void);

export type HookCallback<
  Messages extends string,
  State,
  Attributes,
  Timers extends string,
  MessageSignatures extends CallSignature<Messages>
> = OnHookCallback<Messages, State, Attributes, Timers, MessageSignatures>;

export type AnyHookCallback = HookCallback<any, any, any, any, any>;

export type Hooks<
  State,
  Attributes,
  Messages extends string,
  Timers extends string,
  MessageSignatures extends CallSignature<Messages>
> = {
  [K in Messages]?: HookCallback<Messages, State, Attributes, Timers, MessageSignatures>;
};
