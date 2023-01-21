import { InternalMachine } from './internal-machine';

export type GuardArgument<Messages, State, Attributes> = InternalMachine<
  State,
  Attributes,
  never,
  Messages,
  never,
  never
> & { message: Messages };

export type GuardCallback<State, Attributes> = (arg: GuardArgument<never, State, Attributes>) => boolean;

export type Guards<State, Phases, Attributes> = Array<{
  state: Phases[];
  trap: boolean;
  callback: GuardCallback<State, Attributes>;
}>;
