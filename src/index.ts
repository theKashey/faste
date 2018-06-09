export type MAGIC_EVENTS = "@init" | "@enter" | "@leave" | "@change" | "@miss";
export type MAGIC_PHASES = "@current" | "@busy" | "@locked"

const BUSY_PHASES: MAGIC_PHASES[] = ["@busy", "@locked"];

export interface InternalMachine<State, Attributes, AvailablePhases, Messages, Signals> {
  attrs: Attributes;
  state: State;
  message?: Messages | MAGIC_EVENTS;

  setState(newState: Partial<State>): void;

  transitTo(phase: AvailablePhases): void;

  emit(message: Signals, ...args: any[]): void;

  trigger: (event: Messages, ...args: any[]) => void;
}

export type OnCallback<State, Attributes, AvalablePhases, Messages, Signals> = (slots: InternalMachine<State, Attributes, AvalablePhases, Messages, Signals>, ...args: any[]) => Promise<any> | any;

export type AnyOnCallback = OnCallback<any, any, any, any, any>;

export interface MessagePhase<Phases> {
  phases: Phases[];
}

export interface MessageHandler<State, Attrs, Phases, OnCallback> {
  phases: Phases[];
  callback: OnCallback;
}

export type MessageHandlerArray<State, Attrs, Phases, OnCallback> = MessageHandler<State, Attrs, Phases, OnCallback>[];

export type MessageHandlers<State, Attrs, Phases, Messages, OnCallback> = {
  [name: string]: MessageHandlerArray<State, Attrs, Phases, OnCallback>;
};

export type HookArgument<Messages, State, Attributes> =
  InternalMachine<State, Attributes, "", Messages, "">
  & { message: Messages };
export type OnHookCallback<Messages, State, Attributes, T> = (arg: HookArgument<Messages, State, Attributes>) => T | void;
export type OffHookCallback<Messages, State, Attributes, T> = (arg: HookArgument<Messages, State, Attributes>, hookInfo: T) => void;

export type HookCallback<Messages, State, Attributes, T = any> = {
  on: OnHookCallback<Messages, State, Attributes, T>;
  off: OffHookCallback<Messages, State, Attributes, T>;
};

export type AnyHookCallback = HookCallback<any, any, any>;

export type Hooks<State, Attributes, Messages extends string> = {
  [K in Messages]?: HookCallback<Messages, State, Attributes>
};

export type Callbag<T, K> = (state: 0 | 1 | 2, payload: T) => K;

export type FasteInstanceHooks<MessageHandlers, FasteHooks> = {
  handlers: MessageHandlers;
  hooks: FasteHooks;
};

export type FastInstanceState<State, Attributes, Phases, Messages, Signals> = {
  state: State,
  attrs: Attributes;
  phase?: Phases | MAGIC_PHASES;
  instance?: InternalMachine<State, Attributes, Phases, Messages, Signals>
};

export type ConnectCall<Signals> = (event: Signals, args: any[]) => void;

const callListeners = (listeners: ((...args: any[]) => void)[], ...args: any[]) =>
  listeners.forEach(listener => listener(...args));

export type debugCallback = (instance: any, event: string, ...args: any[]) => any;

let debugFlag: boolean | debugCallback = false;

const debug = (instance: any, event: string, ...args: any[]) => {
  if (debugFlag) {
    if (typeof debugFlag === 'function') {
      debugFlag(instance, event, ...args)
    } else {
      console.debug('Faste:', instance.name ? instance.name : instance, event, ...args);
    }
  }
};

export const setFasteDebug = (flag: debugCallback) => debugFlag = flag;

export interface FastePutable<Messages> {
  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this;
}

export class FasteInstance<State, Attributes, Phases, Messages, Signals, MessageHandlers, FasteHooks> {
  private state: FastInstanceState<State, Attributes, Phases, Messages, Signals>;

  private handlers: FasteInstanceHooks<MessageHandlers, FasteHooks>;

  private stateObservers: ((phase: Phases) => void)[];
  private messageObservers: ConnectCall<Signals>[];
  private messageQueue: ({ message: Messages | MAGIC_EVENTS, args: any })[];
  private callDepth: number;
  private handlersOffValues: any;
  public name: string;

  constructor(state: FastInstanceState<State, Attributes, Phases, Messages, Signals>, handlers: FasteInstanceHooks<MessageHandlers, FasteHooks>) {
    this.state = {...state};
    this.state.instance = this._createInstance({});
    this.handlers = {...handlers};
    this.handlersOffValues = {};

    this.stateObservers = [];
    this.messageObservers = [];

    this.start();
  }

  private _collectHandlers(phase: Phases | MAGIC_PHASES): { [key: string]: boolean } {
    const h = this.handlers.handlers as any;
    return Object
      .keys(h)
      .filter(handler =>
        h[handler].some((hook: MessagePhase<Phases | MAGIC_PHASES>) => !hook.phases || hook.phases.indexOf(phase) >= 0)
      )
      .reduce((acc, key) => ({...acc, [key]: true}), {})
  }

  private _setState(newState: Partial<State>) {
    const oldState = this.state.state;
    this.state.state = Object.assign({}, oldState, newState);
    this.put('@change', oldState);
  };

  private _transitTo(phase: Phases | MAGIC_PHASES) {
    const oldPhase = this.state.phase;
    debug(this, 'transit', phase);
    if (oldPhase != phase) {
      this.__put("@leave", phase);
      this.__performHookOn(phase);
      this.state.phase = phase;
      this.__put('@enter', oldPhase);

      callListeners(this.stateObservers, phase);

      if (BUSY_PHASES.indexOf(phase as any) === -1) {
        if (!this.callDepth) {
          this._executeMessageQueue();
        }
      }
    }
  }

  private _createInstance(options: { phase?: Phases | MAGIC_PHASES, message?: Messages | MAGIC_EVENTS }): InternalMachine<State, Attributes, Phases, Messages, Signals> {
    return {
      state: this.state.state,
      attrs: this.state.attrs,
      message: options.message,
      setState: (newState: Partial<State>) => this._setState(newState),
      transitTo: (phase: Phases | MAGIC_PHASES) => this._transitTo(phase === '@current' ? options.phase : phase),
      emit: (message: Signals, ...args: any[]) => callListeners(this.messageObservers, message, ...args),
      trigger: (event: Messages, ...args: any[]) => this.put(event, ...args),
    }
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
        h[handler].off({
          ...instance,
          message: handler
        }, this.handlersOffValues[handler]);
      }
    });
  }

  private __put(event: string, ...args: any[]) {
    debug(this, 'put', event, args);

    const h: any = this.handlers.handlers;
    const handlers: MessageHandler<State, Attributes, Phases, (state: any, ...args: any[]) => void>[] = h[event] as any;
    let hits = 0;

    const assertBusy = (result: Promise<any> | any) => {
      if (BUSY_PHASES.indexOf(this.state.phase as any) >= 0) {
        if (result && ('then' in result)) {
          // this is async handler
        } else {
          throw new Error('faste: @busy should only be applied for async handlers')
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
      })
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

  namedBy(n: string) {
    this.name = n;
  }

  start(phase?: Phases): this {
    this.messageQueue = [];
    this.callDepth = 0;
    this.__put('@init');
    if (phase) {
      this.state.instance.transitTo(phase);
    }
    return this;
  }

  attrs(attrs: Attributes): this {
    this.state.attrs = Object.assign({}, this.state.attrs || {}, attrs);
    return this;
  }

  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this {
    if (this.callDepth) {
      debug(this, 'queue', message, args);
      this.messageQueue.push({message, args});
    } else {

      switch (this.state.phase) {
        case '@locked':
          debug(this, 'locked', message, args);
          break; //nop
        case '@busy':
          debug(this, 'queue', message, args);
          this.messageQueue.push({message, args});
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

  //connect(plug: FasteInstance<any, any, Signals, any, any, any, any> | ConnectCall<Signals>): this {
  //
  connect(plug: FastePutable<Signals> | ConnectCall<Signals>): this {
    if ('put' in plug) {
      this.messageObservers.push((event: Signals, ...args: any[]) => plug.put(event, ...args))
    } else {
      this.messageObservers.push(plug);
    }
    return this;
  }

  observe(callback: (phase: Phases) => void): this {
    this.stateObservers.push(callback);
    return this;
  }


  phase(): Phases | MAGIC_PHASES {
    return this.state.phase;
  }

  instance(): InternalMachine<State, Attributes, Phases, Messages, Signals> {
    return this._createInstance({});
  }

  destroy(): void {
    this.__performHookOn(undefined);
    this.stateObservers = [];
  }
};

export class Faste<State extends object = {},
  Attributes extends object = {},
  Phases extends string = any,
  Messages extends string = any,
  Signals extends string = any,
  OnCall= OnCallback<State, Attributes, Phases, Messages, Signals>,
  FasteMessageHandlers = MessageHandlers<State, Attributes, Phases, Messages, OnCall>,
  FasteHooks = Hooks<State, Attributes, Phases>,
  > {

  private fState: State;
  private fAttrs: Attributes;
  private fHandlers: MessageHandlers<State, Attributes, Phases, Messages, OnCall>;
  private fHooks: FasteHooks;

  constructor(state?: State, attrs?: Attributes, messages?: FasteMessageHandlers, hooks?: FasteHooks) {
    this.fState = state;
    this.fAttrs = attrs;
    this.fHandlers = messages || {} as any;
    this.fHooks = hooks || {} as FasteHooks;
  }

  on(eventName: Messages, phases: Phases[], callback: OnCall): this;
  on(eventName: Messages, callback: OnCall): this;

  on(...args: any[]): this {
    if (args.length == 2) {
      return this._addHandler(args[0], null, args[1])
    }
    else if (args.length == 3) {
      return this._addHandler(args[0], args[1], args[2])
    }
    return null;
  }

  private _addHandler(eventName: Messages, phases: Phases[], callback: OnCall): this {
    this.fHandlers[eventName] = this.fHandlers[eventName] || [];
    this.fHandlers[eventName].push({
      phases,
      callback
    });
    return this;
  }

  hooks(hooks: Hooks<State, Attributes, Messages>): this {
    Object.assign(this.fHooks, hooks);
    return this;
  }

  check(): boolean {
    return true;
  }

  scope(swapper: (stateIn: this) => void): this {
    swapper(this);
    return this;
  }

  create(): FasteInstance<State, Attributes, Phases, Messages, Signals, MessageHandlers<State, Attributes, Phases, Messages, OnCall>, FasteHooks> {
    return new FasteInstance({
      state: this.fState,
      attrs: this.fAttrs,
      phase: undefined,
      instance: undefined
    }, {
      handlers: this.fHandlers,
      hooks: this.fHooks
    })// as any
  }

  // callbag(): Callbag<any, any>;

  withState<T extends object>(state?: T): Faste<T, Attributes, Phases, Messages, Signals> {
    return new Faste(state, this.fAttrs, this.fHandlers, this.fHooks);
  }

  withAttrs<T extends object>(attributes?: T): Faste<State, T, Phases, Messages, Signals> {
    return new Faste(this.fState, attributes, this.fHandlers, this.fHooks);
  }

  withPhases<T extends string>(phases?: T[]): Faste<State, Attributes, T | MAGIC_PHASES, Messages, Signals> {
    return this as any;
  }

  withMessages<T extends string>(messages?: T[]): Faste<State, Attributes, Phases, T | MAGIC_EVENTS, Signals> {
    return this as any;
  }

  withSignals<T extends string>(signals?: T[]): Faste<State, Attributes, Phases, Messages, T> {
    return this as any;
  }
}

export function faste(): Faste {
  return new Faste();
}