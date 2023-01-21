import { InternalMachine } from './internal-machine';

export type OnCallback<State, Attributes, AvalablePhases, Messages, Signals, Timers extends string> = (
  slots: InternalMachine<State, Attributes, AvalablePhases, Messages, Signals, Timers>,
  ...args: any[]
) => Promise<any> | any;

export type AnyOnCallback = OnCallback<any, any, any, any, any, any>;
