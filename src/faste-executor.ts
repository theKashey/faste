import { callListeners } from './helpers/call';
import { debug } from './helpers/debug';
import { isThenable } from './helpers/thenable';
import { Guards } from './interfaces/guards';
import { InternalMachine } from './interfaces/internal-machine';
import { MessageHandler, MessagePhase } from './interfaces/messages';
import { MAGIC_EVENTS, MAGIC_PHASES } from './types';

type ConnectCall<Signals> = (event: Signals, ...args: any[]) => void;

const BUSY_PHASES: MAGIC_PHASES[] = ['@busy', '@locked'];

export type FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards> = {
  handlers: MessageHandlers;
  hooks: FasteHooks;
  guards: FasteGuards;
};

export type FastInstanceState<State, Attributes, Phases, Messages, Signals, Timers extends string> = {
  state: State;
  attrs: Attributes;
  phase?: Phases | MAGIC_PHASES;
  instance?: InternalMachine<State, Attributes, Phases, Messages, Signals, Timers>;
  timers: Record<Timers, number>;
};

export interface FastePutable<Messages> {
  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this;
}

export class FasteInstance<
  State,
  Attributes,
  Phases,
  Messages,
  Signals,
  MessageHandlers,
  FasteHooks,
  FasteGuards extends Guards<any, any, any>,
  Timers extends string
> {
  private state: FastInstanceState<State, Attributes, Phases, Messages, Signals, Timers>;

  private handlers: FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards>;

  private stateObservers: ((phase: Phases) => void)[];
  private messageObservers: ConnectCall<Signals>[];
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
        this.__put('@leave', phase);
      }

      this.__performHookOn(phase);
      this.state.phase = phase;

      if (!this._started) {
        this.__put('@init');
        this._started = true;
      }

      this.__put('@enter', oldPhase);

      callListeners(this.stateObservers, phase);

      if (BUSY_PHASES.indexOf(phase as any) === -1) {
        if (!this.callDepth) {
          this._executeMessageQueue();
        }
      }
    }

    return true;
  }

  private _createInstance(options: {
    phase?: Phases | MAGIC_PHASES;
    message?: Messages | MAGIC_EVENTS;
  }): InternalMachine<State, Attributes, Phases, Messages, Signals, Timers> {
    return {
      phase: this.state.phase,
      state: this.state.state,
      attrs: this.state.attrs,
      message: options.message,
      setState: (newState: Partial<State> | ((state: State) => Partial<State>)) =>
        typeof newState === 'function' ? this._setState(newState(this.state.state)) : this._setState(newState),
      transitTo: (phase: Phases | MAGIC_PHASES) => this._transitTo(phase === '@current' ? options.phase : phase),
      emit: (message: Signals, ...args: any[]) => callListeners(this.messageObservers, message, ...args),
      trigger: (event: Messages, ...args: any[]) => this.put(event, ...args),
      startTimer: (timerName) => {
        if (!this.timers[timerName]) {
          if (!(timerName in this.state.timers)) {
            throw new Error(`cannot start timer ${timerName} as it missing configuration`);
          }

          this.timers[timerName] = +setTimeout(() => {
            this.timers[timerName] = undefined;
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

  private __performHookOn(nextPhase: Phases | MAGIC_PHASES | null) {
    const oldHandlers = this._started ? this._collectHandlers(this.state.phase) : {};
    const newHandlers = !this._started || nextPhase ? this._collectHandlers(nextPhase) : {};

    const instance = this._createInstance({
      phase: this.state.phase,
    });
    const h = this.handlers.hooks as any;

    Object.keys(newHandlers).forEach((handler) => {
      if (!oldHandlers[handler] && h[handler]) {
        debug(this, 'hook-on', h[handler]);

        this.handlersOffValues[handler] = h[handler].on({
          ...instance,
          message: handler,
        });
      }
    });

    Object.keys(oldHandlers).forEach((handler) => {
      if (!newHandlers[handler] && h[handler]) {
        debug(this, 'hook-off', h[handler]);

        h[handler].off(
          {
            ...instance,
            message: handler,
          },
          this.handlersOffValues[handler]
        );
      }
    });
  }

  private __put(event: string, ...args: any[]): number {
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
        if (!this.__put('@error', error)) {
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
    if (this.messageQueue.length) {
      const q = this.messageQueue;
      this.messageQueue = [];
      q.forEach((q) => this.put(q.message, ...q.args));
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
      if (!this._transitTo(phase)) {
        throw new Error('Faste machine initialization failed - phase was rejected');
      }
    } else {
      this.__put('@init');
      this.__performHookOn(null);
      this._started = true;
    }

    return this;
  }

  /**
   * sets attributes
   * @param attrs
   */
  attrs(attrs: Attributes): this {
    this.state.attrs = Object.assign({}, this.state.attrs || {}, attrs);

    return this;
  }

  /**
   * put the message in
   * @param {String} message
   * @param {any} args
   */
  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this {
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
          this.callDepth++;
          this.__put(message as string, ...args);
          this.callDepth--;

          if (!this.callDepth) {
            this._executeMessageQueue();
          }
      }
    }

    // find
    return this;
  }

  /**
   * Connects one machine to another
   * @param plug
   */
  connect(plug: FastePutable<Signals> | ConnectCall<Signals>): this {
    if ('put' in plug) {
      this.messageObservers.push((event: Signals, ...args: any[]) => plug.put(event, ...args));
    } else {
      this.messageObservers.push(plug);
    }

    return this;
  }

  /**
   * adds change observer. Observer could not be removed.
   * @param callback
   */
  observe(callback: (phase: Phases) => void): this {
    this.stateObservers.push(callback);

    return this;
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
  instance(): InternalMachine<State, Attributes, Phases, Messages, Signals, Timers> {
    return this._createInstance({});
  }

  /**
   * destroys the machine
   */
  destroy(): void {
    this.__performHookOn(undefined);
    this.stateObservers = [];
  }
}
