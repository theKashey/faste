import { InternalMachine } from './internal-machine';
import { CallSignature } from './signatures';
import { MAGIC_EVENTS } from '../types';

export type OnCallback<
  State,
  Attributes,
  AvalablePhases,
  Messages extends string,
  Signals extends string,
  Timers extends string,
  Args extends ReadonlyArray<any>,
  MessageSignatures extends CallSignature<Messages | MAGIC_EVENTS>,
  SignalsSignatures extends CallSignature<Signals>
> = (
  slots: InternalMachine<
    State,
    Attributes,
    AvalablePhases,
    Messages,
    Signals,
    Timers,
    MessageSignatures,
    SignalsSignatures
  >,
  ...args: Args // extends any[] ? Args : never
) => Promise<unknown> | unknown;
