import { callListeners, invokeAsync } from './helpers/call';
import { debug } from './helpers/debug';
import { isThenable } from './helpers/thenable';
import { Guards } from './interfaces/guards';
import { Hooks } from './interfaces/hooks';
import { InternalMachine } from './interfaces/internal-machine';
import { MessageHandler, MessagePhase } from './interfaces/messages';
import { CallSignature, DefaultSignatures, ExtractSignature } from './interfaces/signatures';
import { MAGIC_EVENTS, MAGIC_PHASES } from './types';

type AnyConnectCall<Signals extends string> = (event: Signals, ...args: any[]) => void;

type ConnectCall<Signals extends string, Signatures extends CallSignature<Signals>> = <Signal extends Signals>(
  event: Signal,
  ...args: ExtractSignature<Signatures, Signal, unknown[]>
) => void;

const BUSY_PHASES: MAGIC_PHASES[] = ['@busy', '@locked'];

const START_PHASE = '@start' as const;
const STOP_PHASE = '@destroy' as const;
type START_STOP_PHASES = typeof START_PHASE | typeof STOP_PHASE;

export type FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards> = {
  handlers: MessageHandlers;
  hooks: FasteHooks;
  guards: FasteGuards;
};

export type FastInstanceState<
  State,
  Attributes,
  Phases,
  Messages extends string,
  Signals extends string,
  Timers extends string
> = {
  state: State;
  attrs: Attributes;
  phase?: Phases | MAGIC_PHASES;
  instance?: InternalMachine<State, Attributes, Phases, Messages, Signals, Timers, never, never>;
  timers: Record<Timers, number>;
  asyncSignals: boolean;
};
//
// export type FastePutable<Messages extends string, Signatures extends CallSignature<Messages>> = {
//     put<Message extends Messages>(message: Message, ...args: ExtractSignature<Signatures, Message, []>): any;
// }

export type FastePutable<Messages extends string, Signatures extends CallSignature<Messages>> = {
  put(
    ...args: Parameters<
      FasteInstance<never, never, never, Messages, never, never, never, never, never, Signatures>['put']
    >
  ): any;
};

export class FasteInstance<
  State,
  Attributes,
  Phases extends string,
  Messages extends string,
  Signals extends string,
  MessageHandlers,
  FasteHooks extends Hooks<State, Attributes, Messages, Timers, MessageSignatures>,
  FasteGuards extends Guards<any, any, any>,
  Timers extends string,
  MessageSignatures extends CallSignature<Messages>,
  SignalSignatures extends CallSignature<Signals> = CallSignature<Signals>
> {
  private state: FastInstanceState<State, Attributes, Phases, Messages, Signals, Timers>;

  private handlers: FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards>;

  private stateObservers: ((phase: Phases | MAGIC_PHASES | START_STOP_PHASES) => void)[];
  private messageObservers: ConnectCall<Signals, any>[];
  private messageQueue: { message: Messages | MAGIC_EVENTS; args: any }[];
  private callDepth: number;
  private handlersOffValues: any;
  private _started = false;
  public name: string;

  private timers: Partial<Record<Timers, number | undefined>>;

  constructor(
    state: FastInstanceState<State, Attributes, Phases, Messages, Signals, Timers>,
    handlers: FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards>
  ) {
    this.state = { ...state };
    this.state.instance = this._createInstance({});
    this.handlers = { ...handlers };
    this.handlersOffValues = {};

    this.stateObservers = [];
    this.messageObservers = [];
    this.messageQueue = [];
    this.timers = {};
  }

  private _collectHandlers(phase: Phases | MAGIC_PHASES): { [key: string]: boolean } {
    const h = this.handlers.handlers as any;

    return Object.keys(h)
      .filter((handler) =>
        h[handler].some((hook: MessagePhase<Phases | MAGIC_PHASES>) => !hook.phases || hook.phases.indexOf(phase) >= 0)
      )
      .reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }

  private _setState(newState: Partial<State>) {
    const oldState = this.state.state;
    this.state.state = Object.assign({}, oldState, newState);
    // @ts-expect-error
    this.put('@change', oldState);
  }

  private _trySingleGuard(phase: Phases | MAGIC_PHASES, isTrap: boolean): boolean {
    const instance = this._createInstance({
      phase: phase,
    });

    // find traps
    return this.handlers.guards
      .filter(({ state, trap }) => state.indexOf(phase) >= 0 && trap === isTrap)
      .reduce((acc, { callback }) => acc && callback(instance as any), true);
  }

  private _tryGuard(oldPhase: Phases | MAGIC_PHASES, newPhase: Phases | MAGIC_PHASES): boolean {
    return this._trySingleGuard(oldPhase, true) && this._trySingleGuard(newPhase, false);
  }

  private _transitTo(phase: Phases | MAGIC_PHASES) {
    const oldPhase = this.state.phase;
    debug(this, 'transit', phase);

    if (oldPhase != phase) {
      if (!this._tryGuard(oldPhase, phase)) {
        this.__put('@guard', phase);

        return false;
      }

      if (oldPhase) {
        this.__put('@leave', phase, oldPhase);
      }

      this.__performHookOn(phase);
      this.state.phase = phase;

      if (!this._started) {
        this._initialize();
      }

      callListeners(this.stateObservers, phase);

      this.__put('@enter', oldPhase, phase);
    }

    return true;
  }

  private _createInstance(options: {
    phase?: Phases | MAGIC_PHASES;
    message?: Messages | MAGIC_EVENTS;
  }): InternalMachine<State, Attributes, Phases, Messages, Signals, Timers, MessageSignatures, SignalSignatures> {
    return {
      phase: this.state.phase,
      state: this.state.state,
      attrs: this.state.attrs,
      message: options.message,
      setState: (newState) =>
        typeof newState === 'function' ? this._setState(newState(this.state.state)) : this._setState(newState),
      transitTo: (phase) => this._transitTo(phase === '@current' ? options.phase : phase),
      emit: (message, ...args) => {
        if (!this._started) {
          // there could be events running after destruction
          return;
        }

        this.state.asyncSignals
          ? invokeAsync(() => callListeners(this.messageObservers as ConnectCall<any, any>[], message, ...args))
          : callListeners(this.messageObservers as ConnectCall<any, any>[], message, ...args);
      },
      trigger: (event, ...args) => this.put(event, ...(args as any)),
      startTimer: (timerName) => {
        if (!this._started) {
          // there could be events running after destruction
          return;
        }

        if (!this.timers[timerName]) {
          if (!(timerName in this.state.timers)) {
            throw new Error(`cannot start timer ${timerName} as it missing configuration`);
          }

          this.timers[timerName] = +setTimeout(() => {
            this.timers[timerName] = undefined;
            // @ts-expect-error
            this.put(`on_${timerName}` as any);
          }, this.state.timers[timerName]);
        }
      },
      stopTimer: (timerName) => {
        if (this.timers[timerName]) {
          clearTimeout(this.timers[timerName]);
          this.timers[timerName] = undefined;
        }
      },
    };
  }

  private __performHookOn(nextPhase: Phases | MAGIC_PHASES | null, initialState = false) {
    const oldHandlers = !initialState ? this._collectHandlers(this.state.phase) : {};
    const newHandlers = initialState || nextPhase ? this._collectHandlers(nextPhase) : {};

    const instance = this._createInstance({
      phase: this.state.phase,
    });
    const h = this.handlers.hooks;

    Object.keys(newHandlers).forEach((handler: Messages) => {
      if (!oldHandlers[handler] && h[handler]) {
        debug(this, 'hook-on', h[handler]);

        this.handlersOffValues[handler] = h[handler]({
          ...instance,
          phase: undefined,
          message: handler,
        });
      }
    });

    Object.keys(oldHandlers).forEach((handler: Messages) => {
      if (!newHandlers[handler] && h[handler] && this.handlersOffValues[handler]) {
        debug(this, 'hook-off', h[handler]);

        this.handlersOffValues[handler]({
          ...instance,
          phase: undefined,
          message: handler,
        });

        this.handlersOffValues[handler] = undefined;
      }
    });
  }

  private __put(event: string, ...args: any[]): number {
    this.callDepth++;

    const result = this.__direct_put(event, ...args);
    this.callDepth--;

    if (BUSY_PHASES.indexOf(this.state.phase as any) === -1) {
      if (!this.callDepth) {
        this._executeMessageQueue();
      }
    }

    return result;
  }

  private __direct_put(event: string, ...args: any[]): number {
    debug(this, 'put', event, args);

    const h: any = this.handlers.handlers;
    const handlers: MessageHandler<State, Attributes, Phases, (state: any, ...args: any[]) => void>[] = h[event] as any;
    let hits = 0;

    const assertBusy = (result: Promise<any> | any) => {
      if (BUSY_PHASES.indexOf(this.state.phase as any) >= 0) {
        if (isThenable(result)) {
          // this is async handler
        } else {
          throw new Error('faste: @busy should only be applied for async handlers');
        }
      }

      return result;
    };

    // Precache state, to prevent message to be passed to the changed state
    const phase = this.state.phase;

    if (handlers) {
      const instance = this._createInstance({
        phase,
        message: event as any,
      });

      const handleError = (error: Error) => {
        if (!this.__direct_put('@error', error)) {
          throw error;
        }
      };

      const executeHandler = (handler: (typeof handlers)[0]) => {
        debug(this, 'message-handler', event, handler);

        try {
          const invocationResult = assertBusy(handler.callback(instance, ...args));

          if (isThenable(invocationResult)) {
            invocationResult.catch(handleError);
          }
        } catch (e) {
          handleError(e);
        }

        hits++;
      };

      handlers.forEach((handler) => {
        if (handler.phases && handler.phases.length > 0) {
          if (handler.phases.indexOf(phase as any) >= 0) {
            executeHandler(handler);
          }
        } else {
          executeHandler(handler);
        }
      });
    }

    if (!hits) {
      if (event[0] !== '@') {
        this.__put('@miss', event);
      }
    }

    return hits;
  }

  _executeMessageQueue() {
    while (this.messageQueue.length) {
      const q = this.messageQueue;
      this.messageQueue = [];
      this.callDepth++;
      q.forEach((q) => this.__put(q.message, ...q.args));
      this.callDepth--;
    }
  }

  /**
   * sets name to a machine (debug only)
   * @param n
   */
  namedBy(n: string) {
    this.name = n;

    return this;
  }

  /**
   * starts the machine
   * @param phase
   */
  start(phase?: Phases): this {
    this.messageQueue = [];
    this.callDepth = 0;
    this._started = false;

    if (phase) {
      callListeners(this.stateObservers, START_PHASE);

      if (!this._transitTo(phase)) {
        throw new Error('Faste machine initialization failed - phase was rejected');
      }
    } else {
      this._initialize();
    }

    return this;
  }

  /**
   * returns if machine currently running
   */
  isStarted() {
    return this._started;
  }

  /**
   * sets attributes
   * @param attrs
   */
  attrs(attrs: Attributes): this {
    this.state.attrs = Object.assign({}, this.state.attrs || {}, attrs);

    return this;
  }

  // private innerPut<Message extends Messages | MAGIC_EVENTS>(
  //     message: Message,
  //     ...args: ExtractSignature<MessageSignatures, Message>
  // ): this {
  //     return this.put(message as any, ...args);
  // }
  /**
   * put the message in
   * @param {String} message
   * @param {any} args
   */
  put<Message extends Exclude<Messages, MAGIC_EVENTS>>(
    message: Message,
    ...args: ExtractSignature<MessageSignatures, Message>
  ): this {
    if (!this._started) {
      console.error('machine is not started');

      return;
    }

    if (this.callDepth) {
      debug(this, 'queue', message, args);
      this.messageQueue.push({ message, args });
    } else {
      switch (this.state.phase) {
        case '@locked':
          debug(this, 'locked', message, args);
          break; //nop
        case '@busy':
          debug(this, 'queue', message, args);
          this.messageQueue.push({ message, args });
          break;

        default:
          this.__put(message as string, ...args);
      }
    }

    // find
    return this;
  }

  /**
   * Connects this machine output with another machine input
   * @param receiver
   * @returns disconnect function
   *
   * arguments are untyped, use {@see castSignalArgument} to retype them
   */
  connect<UsedSignals extends Signals = Signals>(
    receiver: AnyConnectCall<UsedSignals> | FastePutable<UsedSignals, SignalSignatures>
  ) {
    const connector: ConnectCall<UsedSignals, any> =
      'put' in receiver ? (event, ...args) => receiver.put(event as any, ...(args as any)) : receiver;

    this.messageObservers.push(connector);

    return () => {
      const element = this.messageObservers.indexOf(connector);

      if (element >= 0) {
        this.messageObservers.splice(element, 1);
      }
    };
  }

  /**
   * retypes signal arguments
   * @example
   * ```tsx
   * control.connect((event,...args)=> {
   *   switch(event){
   *    case "tick":
   *      const [payload] = control.castSignalArgument(event, args);
   *      payload.startsWith(); // now type is known
   *    }
   * })
   * ```
   */
  castSignalArgument<Signal extends Signals>(name: Signal, ...args: any[]): ExtractSignature<SignalSignatures, Signal> {
    return args as any;
  }

  /**
   * adds change observer. Observer could not be removed.
   * @param callback
   * @returns un-observe function
   */
  observe(callback: (phase: Phases | MAGIC_PHASES | START_STOP_PHASES) => void) {
    this.stateObservers.push(callback);

    return () => {
      const element = this.stateObservers.indexOf(callback);

      if (element >= 0) {
        this.stateObservers.splice(element, 1);
      }
    };
  }

  /**
   * returns the current phase
   */
  phase(): Phases | MAGIC_PHASES {
    return this.state.phase;
  }

  /**
   * return an internal instance
   */
  instance(): InternalMachine<
    State,
    Attributes,
    Phases,
    Messages,
    Signals,
    Timers,
    MessageSignatures,
    SignalSignatures
  > {
    return this._createInstance({});
  }

  private _initialize() {
    this._started = true;
    this.__put('@init');
    this.__performHookOn(null, true);
  }
  /**
   * destroys the machine
   */
  destroy(): void {
    this.__performHookOn(undefined);
    callListeners(this.stateObservers, STOP_PHASE);

    Object.entries(this.timers).forEach(([, value]) => {
      clearTimeout(value as any);
    });

    this.timers = {};
    this.stateObservers = [];
    //
    this._started = false;
  }
}
