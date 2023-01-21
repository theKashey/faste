import { MAGIC_EVENTS, MAGIC_PHASES } from '../types';

export type InternalMachine<State, Attributes, AvailablePhases, Messages, Signals, Timers extends string> = Readonly<{
  /**
   * machine attributes
   */
  attrs: Attributes;
  /**
   * machine state
   */
  state: State;
  phase: AvailablePhases | MAGIC_PHASES;
  /**
   * current message
   */
  message?: Messages | MAGIC_EVENTS;

  /**
   * update machine state
   * @param newState
   */
  setState(newState: Partial<State>): void;

  setState(cb: (oldState: State) => Partial<State>): void;

  /**
   * changes machine phase
   * @param phase
   */
  transitTo(phase: AvailablePhases | MAGIC_PHASES): boolean;

  /**
   * sends a signal to the outer world
   * @param message
   * @param args
   */
  emit(message: Signals, ...args: any[]): void;

  /**
   * sends a signal back to the machine
   * @param event
   * @param args
   */
  trigger: (event: Messages, ...args: any[]) => void;

  /**
   * Starts timer
   */
  startTimer: (timerName: Timers) => void;
  /**
   * Stops timers
   * @param timerName
   */
  stopTimer: (timerName: Timers) => void;
}>;
