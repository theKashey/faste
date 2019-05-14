export type MAGIC_EVENTS =
  | '@init'
  | '@enter'
  | '@leave'
  | '@change'
  | '@miss'
  | '@guard';
export type MAGIC_PHASES = '@current' | '@busy' | '@locked';

const BUSY_PHASES: MAGIC_PHASES[] = ['@busy', '@locked'];

export interface InternalMachine<
  State,
  Attributes,
  AvailablePhases,
  Messages,
  Signals
> {
  /**
   * machine attributes
   */
  attrs: Attributes;
  /**
   * machine state
   */
  state: State;
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
}

export type OnCallback<State, Attributes, AvalablePhases, Messages, Signals> = (
  slots: InternalMachine<State, Attributes, AvalablePhases, Messages, Signals>,
  ...args: any[]
) => Promise<any> | any;

export type AnyOnCallback = OnCallback<any, any, any, any, any>;

export interface MessagePhase<Phases> {
  phases: Phases[];
}

export interface MessageHandler<State, Attrs, Phases, OnCallback> {
  phases: Phases[];
  callback: OnCallback;
}

export type MessageHandlerArray<
  State,
  Attrs,
  Phases,
  OnCallback
> = MessageHandler<State, Attrs, Phases, OnCallback>[];

export type MessageHandlers<State, Attrs, Phases, Messages, OnCallback> = {
  [name: string]: MessageHandlerArray<State, Attrs, Phases, OnCallback>;
};

export type GuardCallback<State, Attributes> = (
  arg: HookArgument<any, State, Attributes>
) => boolean;

export type Guards<State, Phases, Attributes> = Array<{
  state: Phases[];
  trap: boolean;
  callback: GuardCallback<State, Attributes>;
}>;

export type HookArgument<Messages, State, Attributes> = InternalMachine<
  State,
  Attributes,
  '',
  Messages,
  ''
> & { message: Messages };
export type OnHookCallback<Messages, State, Attributes, T> = (
  arg: HookArgument<Messages, State, Attributes>
) => T | void;
export type OffHookCallback<Messages, State, Attributes, T> = (
  arg: HookArgument<Messages, State, Attributes>,
  hookInfo: T
) => void;

export type HookCallback<Messages, State, Attributes, T = any> = {
  on: OnHookCallback<Messages, State, Attributes, T>;
  off: OffHookCallback<Messages, State, Attributes, T>;
};

export type AnyHookCallback = HookCallback<any, any, any>;

export type Hooks<State, Attributes, Messages extends string> = {
  [K in Messages]?: HookCallback<Messages, State, Attributes>
};

export type Callbag<T, K> = (state: 0 | 1 | 2, payload: T) => K;

export type FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards> = {
  handlers: MessageHandlers;
  hooks: FasteHooks;
  guards: FasteGuards;
};

export type FastInstanceState<State, Attributes, Phases, Messages, Signals> = {
  state: State;
  attrs: Attributes;
  phase?: Phases | MAGIC_PHASES;
  instance?: InternalMachine<State, Attributes, Phases, Messages, Signals>;
};

export type ConnectCall<Signals> = (event: Signals, args: any[]) => void;

const callListeners = (
  listeners: ((...args: any[]) => void)[],
  ...args: any[]
) => listeners.forEach(listener => listener(...args));

export type debugCallback = (
  instance: any,
  event: string,
  ...args: any[]
) => any;

let debugFlag: boolean | debugCallback = false;

const debug = (instance: any, event: string, ...args: any[]) => {
  if (debugFlag) {
    if (typeof debugFlag === 'function') {
      debugFlag(instance, event, ...args);
    } else {
      console.debug(
        'Faste:',
        instance.name ? instance.name : instance,
        event,
        ...args
      );
    }
  }
};

/**
 * enabled debug
 * @param flag
 */
export const setFasteDebug = (flag: debugCallback) => (debugFlag = flag);

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
  FasteGuards extends Guards<any, any, any>
> {
  private state: FastInstanceState<
    State,
    Attributes,
    Phases,
    Messages,
    Signals
  >;

  private handlers: FasteInstanceHooks<
    MessageHandlers,
    FasteHooks,
    FasteGuards
  >;

  private stateObservers: ((phase: Phases) => void)[];
  private messageObservers: ConnectCall<Signals>[];
  private messageQueue: ({ message: Messages | MAGIC_EVENTS; args: any })[];
  private callDepth: number;
  private handlersOffValues: any;
  private _started: boolean = false;
  public name: string;

  constructor(
    state: FastInstanceState<State, Attributes, Phases, Messages, Signals>,
    handlers: FasteInstanceHooks<MessageHandlers, FasteHooks, FasteGuards>
  ) {
    this.state = { ...state };
    this.state.instance = this._createInstance({});
    this.handlers = { ...handlers };
    this.handlersOffValues = {};

    this.stateObservers = [];
    this.messageObservers = [];
  }

  private _collectHandlers(
    phase: Phases | MAGIC_PHASES
  ): { [key: string]: boolean } {
    const h = this.handlers.handlers as any;
    return Object.keys(h)
      .filter(handler =>
        h[handler].some(
          (hook: MessagePhase<Phases | MAGIC_PHASES>) =>
            !hook.phases || hook.phases.indexOf(phase) >= 0
        )
      )
      .reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }

  private _setState(newState: Partial<State>) {
    const oldState = this.state.state;
    this.state.state = Object.assign({}, oldState, newState);
    this.put('@change', oldState);
  }

  private _trySingleGuard(
    phase: Phases | MAGIC_PHASES,
    isTrap: boolean
  ): boolean {
    const instance = this._createInstance({
      phase: phase
    });
    // find traps
    return this.handlers.guards
      .filter(({ state, trap }) => state.indexOf(phase) >= 0 && trap === isTrap)
      .reduce((acc, { callback }) => acc && callback(instance as any), true);
  }

  private _tryGuard(
    oldPhase: Phases | MAGIC_PHASES,
    newPhase: Phases | MAGIC_PHASES
  ): boolean {
    return (
      this._trySingleGuard(oldPhase, true) &&
      this._trySingleGuard(newPhase, false)
    );
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
  }): InternalMachine<State, Attributes, Phases, Messages, Signals> {
    return {
      state: this.state.state,
      attrs: this.state.attrs,
      message: options.message,
      setState: (
        newState: Partial<State> | ((state: State) => Partial<State>)
      ) =>
        typeof newState === 'function'
          ? this._setState(newState(this.state.state))
          : this._setState(newState),
      transitTo: (phase: Phases | MAGIC_PHASES) =>
        this._transitTo(phase === '@current' ? options.phase : phase),
      emit: (message: Signals, ...args: any[]) =>
        callListeners(this.messageObservers, message, ...args),
      trigger: (event: Messages, ...args: any[]) => this.put(event, ...args)
    };
  }

  private __performHookOn(nextPhase: Phases | MAGIC_PHASES | null) {
    const oldHandlers = this._collectHandlers(this.state.phase);
    const newHandlers = nextPhase ? this._collectHandlers(nextPhase) : {};

    const instance = this._createInstance({
      phase: this.state.phase
    });
    const h = this.handlers.hooks as any;

    Object.keys(newHandlers).forEach(handler => {
      if (!oldHandlers[handler] && h[handler]) {
        debug(this, 'hook-on', h[handler]);
        this.handlersOffValues[handler] = h[handler].on({
          ...instance,
          message: handler
        });
      }
    });

    Object.keys(oldHandlers).forEach(handler => {
      if (!newHandlers[handler] && h[handler]) {
        debug(this, 'hook-off', h[handler]);
        h[handler].off(
          {
            ...instance,
            message: handler
          },
          this.handlersOffValues[handler]
        );
      }
    });
  }

  private __put(event: string, ...args: any[]) {
    debug(this, 'put', event, args);

    const h: any = this.handlers.handlers;
    const handlers: MessageHandler<
      State,
      Attributes,
      Phases,
      (state: any, ...args: any[]) => void
    >[] = h[event] as any;
    let hits = 0;

    const assertBusy = (result: Promise<any> | any) => {
      if (BUSY_PHASES.indexOf(this.state.phase as any) >= 0) {
        if (result && 'then' in result) {
          // this is async handler
        } else {
          throw new Error(
            'faste: @busy should only be applied for async handlers'
          );
        }
      }
    };

    // Precache state, to prevent message to be passed to the changed state
    const phase = this.state.phase;
    if (handlers) {
      const instance = this._createInstance({
        phase,
        message: event as any
      });

      handlers.forEach(handler => {
        if (handler.phases && handler.phases.length > 0) {
          if (handler.phases.indexOf(phase as any) >= 0) {
            debug(this, 'message-handler', event, handler);
            assertBusy(handler.callback(instance, ...args));
            hits++;
          }
        } else {
          debug(this, 'message-handler', event, handler);
          assertBusy(handler.callback(instance, ...args));
          hits++;
        }
      });
    }

    if (!hits) {
      if (event[0] !== '@') {
        this.__put('@miss', event);
      }
    }
  }

  _executeMessageQueue() {
    if (this.messageQueue.length) {
      const q = this.messageQueue;
      this.messageQueue = [];
      q.forEach(q => this.put(q.message, ...q.args));
    }
  }

  /**
   * sets name to a machine (debug only)
   * @param n
   */
  namedBy(n: string) {
    this.name = n;
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
        throw new Error(
          'Faste machine initialization failed - phase was rejected'
        );
      }
    } else {
      this.__put('@init');
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
      this.messageObservers.push((event: Signals, ...args: any[]) =>
        plug.put(event, ...args)
      );
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
  instance(): InternalMachine<State, Attributes, Phases, Messages, Signals> {
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

export type SomethingOf<T extends string, K extends T> = Partial<K>;

export type PhaseTransition<T extends string, K> = { [key in T]: K };

export type PhaseTransitionSetup<
  K extends string,
  T extends PhaseTransition<K, Partial<K>>
> = { [key in keyof T]: T[key][] };

/**
 * The Faste machine
 * @name Faste
 */
export class Faste<
  State extends object = {},
  Attributes extends object = {},
  Phases extends string = any,
  Transitions extends PhaseTransition<
    Phases,
    Partial<Phases>
  > = PhaseTransition<Phases, Phases>,
  Messages extends string = any,
  Signals extends string = any,
  OnCall = OnCallback<State, Attributes, Phases, Messages, Signals>,
  FasteMessageHandlers = MessageHandlers<
    State,
    Attributes,
    Phases,
    Messages,
    OnCall
  >,
  FasteHooks = Hooks<State, Attributes, Phases>
> {
  private fState: State;
  private fAttrs: Attributes;
  private fHandlers: MessageHandlers<
    State,
    Attributes,
    Phases,
    Messages,
    OnCall
  >;
  private fHooks: FasteHooks;
  private fGuards: Guards<State, Phases, Attributes>;

  constructor(
    state?: State,
    attrs?: Attributes,
    messages?: FasteMessageHandlers,
    hooks?: FasteHooks,
    guards?: Guards<State, Phases, Attributes>
  ) {
    this.fState = state;
    this.fAttrs = attrs;
    this.fHandlers = messages || ({} as any);
    this.fHooks = hooks || ({} as FasteHooks);
    this.fGuards = guards || [];
  }

  /**
   * Adds event handler
   * @param {String} eventName
   * @param {String[]} phases
   * @param callback
   *
   * @example machine.on('disable', ['enabled'], ({transitTo}) => transitTo('disabled');
   */
  public on<K extends Phases>(
    eventName: Messages,
    phases: K[],
    callback: OnCallback<State, Attributes, Transitions[K], Messages, Signals>
  ): this;
  // on(eventName: Messages, phases: Phases[], callback: OnCall): this;
  /**
   * Adds event handler
   * @param {String} eventName
   * @param callback
   */
  public on(eventName: Messages, callback: OnCall): this;

  /**
   * Adds event handler
   * @param args
   */
  public on(...args: any[]): this {
    if (args.length == 2) {
      return this._addHandler(args[0], null, args[1]);
    } else if (args.length == 3) {
      return this._addHandler(args[0], args[1], args[2]);
    }
    return null;
  }

  private _addHandler(
    eventName: Messages,
    phases: Phases[],
    callback: OnCall
  ): this {
    this.fHandlers[eventName] = this.fHandlers[eventName] || [];
    this.fHandlers[eventName].push({
      phases,
      callback
    });
    return this;
  }

  /**
   * Adds hooks to the faste machine
   * @param hooks
   *
   * @example machine.hooks({
   *  click: {
   *   on: onCallback,
   *   off: offCallback,
   * }});
   */
  public hooks(hooks: Hooks<State, Attributes, Messages>): this {
    Object.assign(this.fHooks, hooks);
    return this;
  }

  /**
   * Adds a guard, which may block transition TO the phase
   * @param {String[]} state
   * @param callback
   */
  public guard(
    state: Phases[],
    callback: GuardCallback<State, Attributes>
  ): this {
    this.fGuards.push({ state, callback, trap: false });
    return this;
  }

  /**
   * Add a trap, which may block transition FROM the phase
   * @param state
   * @param callback
   */
  public trap(
    state: Phases[],
    callback: GuardCallback<State, Attributes>
  ): this {
    this.fGuards.push({ state, callback, trap: true });
    return this;
  }

  /**
   * checks that machine is build properly
   */
  public check(): boolean {
    return true;
  }

  /**
   * Executes callback inside faste machine, could be used to reuse logic among different machines
   * @param {Function }swapper
   *
   * @example machine.scope( machine => machine.on('something');
   */
  scope(swapper: (stateIn: this) => void): this {
    swapper(this);
    return this;
  }

  /**
   * creates a Faste Machine from a blueprint
   */
  create(): FasteInstance<
    State,
    Attributes,
    Phases,
    Messages,
    Signals,
    MessageHandlers<State, Attributes, Phases, Messages, OnCall>,
    FasteHooks,
    Guards<State, Phases, Attributes>
  > {
    return new FasteInstance(
      {
        state: this.fState,
        attrs: this.fAttrs,
        phase: undefined,
        instance: undefined
      },
      {
        handlers: this.fHandlers,
        hooks: this.fHooks,
        guards: this.fGuards
      }
    ); // as any
  }

  /**
   * Defines the State
   * @param state
   */
  withState<T extends object>(
    state?: T
  ): Faste<T, Attributes, Phases, Transitions, Messages, Signals> {
    return new Faste(state, this.fAttrs, this.fHandlers, this.fHooks, this
      .fGuards as any);
  }

  /**
   * Defines the Attributes
   * @param attributes
   */
  withAttrs<T extends object>(
    attributes?: T
  ): Faste<State, T, Phases, Transitions, Messages, Signals> {
    return new Faste(this.fState, attributes, this.fHandlers, this.fHooks, this
      .fGuards as any);
  }

  /**
   * Defines possible Phases
   * @param phases
   */
  withPhases<T extends string>(
    phases?: T[]
  ): Faste<State, Attributes, T, PhaseTransition<T, T>, Messages, Signals> {
    return this as any;
  }

  /**
   * Defines possible Phases Transitions
   * @param transitions
   */
  withTransitions<T extends PhaseTransition<Phases, Partial<Phases>>>(
    transitions: PhaseTransitionSetup<Phases, T>
  ): Faste<State, Attributes, Phases, T, Messages, Signals> {
    return this as any;
  }

  /**
   * Defines possible "in" events
   * @param messages
   */
  withMessages<T extends string>(
    messages?: T[]
  ): Faste<State, Attributes, Phases, Transitions, T | MAGIC_EVENTS, Signals> {
    return this as any;
  }

  /**
   * Defines possible "out" events
   * @param signals
   */
  withSignals<T extends string>(
    signals?: T[]
  ): Faste<State, Attributes, Phases, Transitions, Messages, T> {
    return this as any;
  }
}

/**
 * Creates a faste machine
 */
export function faste(): Faste {
  return new Faste();
}
