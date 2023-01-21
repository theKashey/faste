import { HookArgument } from './hooks';

export type GuardCallback<State, Attributes> = (arg: HookArgument<any, State, Attributes>) => boolean;

export type Guards<State, Phases, Attributes> = Array<{
  state: Phases[];
  trap: boolean;
  callback: GuardCallback<State, Attributes>;
}>;
