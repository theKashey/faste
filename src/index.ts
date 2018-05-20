export type MAGIC_EVENTS = "@init" | "@enter" | "@leave" | "@change" | "@miss";
export type MAGIC_PHASES = "@current" | "@busy" | "@locked"

const BUSY_PHASES: MAGIC_PHASES[] = ["@busy", "@locked"];

export interface InternalMachine<State, Attributes, AvalablePhases, Signals> {
  attrs: Attributes;
  state: State;

  setState(newState: Partial<State>): void;

  transitTo(phase: AvalablePhases): void;

  emit(message: Signals, ...args: any[]): void
}

export type OnCallback<State, Attributes, AvalablePhases, Signals> = (slots: InternalMachine<State, Attributes, AvalablePhases, Signals>, ...args: any[]) => Promise<any> | void;

export interface MessagePhase<Phases> {
  phases: Phases[];
}

export interface MessageHandler<State, Attrs, Phases, OnCallback> {
  phases: Phases[];
  callback: OnCallback;
}

type MessageHandlerArray<State, Attrs, Phases, OnCallback> = MessageHandler<State, Attrs, Phases, OnCallback>[];

export type MessageHandlers<State, Attrs, Phases, Messages, OnCallback> = {
  [name: string]: MessageHandlerArray<State, Attrs, Phases, OnCallback>;
};

export type OnHookCallback<Messages, State, Attributes, T> = (arg: { attrs: Attributes, state: State, message: Messages }) => T | void;
export type OffHookCallback<Messages, State, Attributes, T> = (arg: { attrs: Attributes, state: State, message: Messages }, hookInfo: T) => void;

export type HookCallback<Messages, State, Attributes, T = any> = {
  on: OnHookCallback<Messages, State, Attributes, T>;
  off: OffHookCallback<Messages, State, Attributes, T>;
};

export type Hooks<State, Attributes, Messages extends string> = {
  [K in Messages]?: HookCallback<Messages, State, Attributes>
};

export type Callbag<T, K> = (state: 0 | 1 | 2, payload: T) => K;

type FasteInstanceHooks<MessageHandlers, FasteHooks> = {
  handlers: MessageHandlers;
  hooks: FasteHooks;
};

type FastInstanceState<State, Attributes, Phases, Signals> = {
  state: State,
  attrs: Attributes;
  phase?: Phases | MAGIC_PHASES;
  instance?: InternalMachine<State, Attributes, Phases, Signals>
};

type ConnectCall<Signals> = (event: Signals, args: any[]) => void;

const callListeners = (listeners: ((...args: any[]) => void)[], ...args: any[]) =>
  listeners.forEach(listener => listener(...args));

interface FastePutable<Messages> {
  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this;
}

export class FasteInstance<State, Attributes, Phases, Messages, Signals, MessageHandlers, FasteHooks> {
  private state: FastInstanceState<State, Attributes, Phases, Signals>;

  private handlers: FasteInstanceHooks<MessageHandlers, FasteHooks>;

  private stateObservers: ((phase: Phases) => void)[];
  private messageObservers: ConnectCall<Signals>[];
  private messageQueue: ({ message: Messages | MAGIC_EVENTS, args: any })[];
  private callDepth: number;

  constructor(state: FastInstanceState<State, Attributes, Phases, Signals>, handlers: FasteInstanceHooks<MessageHandlers, FasteHooks>) {
    this.state = {
      ...state,
      instance: this._createInstance()
    };
    this.handlers = handlers;
  }

  private _collectHandlers(phase: Phases | MAGIC_PHASES): { [key: string]: boolean } {
    const h = this.handlers as any;
    return Object
      .keys(this.handlers)
      .filter(handler => {
        h[handler].some((hook: MessagePhase<Phases | MAGIC_PHASES>) => !hook.phases || hook.phases.indexOf(phase) >= 0)
      })
      .reduce((acc, key) => ({...acc, [key]: true}), {})
  }

  private _setState(newState: Partial<State>) {
    const oldState = this.state.state;
    this.state.state = Object.assign({}, oldState, newState);
    this.put('@change', oldState);
  };

  private _transitTo(phase: Phases) {
    const oldPhase = this.state.phase;
    if (oldPhase != phase) {
      this.__put("@leave", this.state.phase);
      this.__performHookOff(phase);
      this.state.phase = phase;
      this.__put('@enter', oldPhase);

      callListeners(this.stateObservers, phase);

      if (BUSY_PHASES.indexOf(phase as any) === -1) {
        this._executeMessageQueue();
      }
    }
  }

  private _createInstance(): InternalMachine<State, Attributes, Phases, Signals> {
    return {
      state: this.state.state,
      attrs: this.state.attrs,
      setState: (newState: Partial<State>) => this._setState(newState),
      transitTo: (phase: Phases) => this._transitTo(phase),
      emit: (message: Signals, ...args: any[]) => callListeners(this.messageObservers, message, ...args),
    }
  }

  private __performHookOff(nextPhase: Phases | null) {
    const oldHandlers = this._collectHandlers(this.state.phase);
    const newHandlers = nextPhase ? this._collectHandlers(nextPhase) : {};

    const instance = this._createInstance();
    const h = this.handlers as any;

    Object.keys(oldHandlers).forEach(handler => {
      if (!newHandlers[handler]) {
        h[handler].off(instance, h[handler].onValue);
      }
    });

    Object.keys(newHandlers).forEach(handler => {
      if (!oldHandlers[handler]) {
        h[handler].onValue = h[handler].on(instance);
      }
    });
  }

  private __put(event: string, ...args: any[]) {
    const h: any = this.handlers.handlers;
    const handlers: MessageHandler<State, Attributes, Phases, (state: any, ...args: any[]) => void>[] = h[event] as any;
    let hits = 0;

    if (handlers) {
      handlers.forEach(handler => {
        const instance = this._createInstance();
        if (handler.phases && handler.phases.length > 0) {
          if (handler.phases.indexOf(this.state.phase as any) >= 0) {
            handler.callback(instance, ...args);
            hits++;
          }
        } else {
          handler.callback(instance, ...args);
          hits++;
        }
      })
    }

    if (!hits) {
      if (event !== '@miss') {
        this.__put('@miss', event);
      }
    }
  }

  _executeMessageQueue() {
    if (this.messageQueue.length) {
      this.messageQueue.forEach(q => this.put(q.message, ...q.args));
      this.messageQueue = [];
    }
  }

  start(phase?: Phases): this {
    this.stateObservers = [];
    this.messageObservers = [];
    this.messageQueue = [];
    this.callDepth = 0;
    this.__put('@init');

    if (phase) {
      this.state.instance.transitTo(phase);
    }
    return this;
  }

  attrs(attrs: Attributes): this {
    this.state.attrs = Object.assign(this.state.attrs || {}, attrs);
    return this;
  }

  put(message: Messages | MAGIC_EVENTS, ...args: any[]): this {
    if (this.callDepth) {
      this.messageQueue.push({message, args});
    } else {
      this.callDepth++;
      switch (this.state.phase) {
        case '@locked':
          break; //nop
        case '@busy':
          this.messageQueue.push({message, args});
          break;
        default:
          this.__put(message as string, args);
      }
      this.callDepth--;
      if (!this.callDepth) {
        this._executeMessageQueue();
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

  instance(): InternalMachine<State, Attributes, Phases, Signals> {
    return this._createInstance();
  }

  destroy(): void {
    this.__performHookOff(undefined);
    this.stateObservers = [];
  }
};

class Faste<State extends object = {},
  Attributes extends object = {},
  Phases extends string = any,
  Messages extends string = any,
  Signals extends string = any,
  OnCall= OnCallback<State, Attributes, Phases, Signals>,
  FasteMessageHandlers = MessageHandlers<State, Attributes, Phases, Messages, OnCall>,
  FasteHooks = Hooks<State, Attributes, Phases>,
  > {

  private fState: State;
  private fAttrs: Attributes;
  // private fPhases: Phases[];
  private fHandlers: MessageHandlers<State, Attributes, Phases, Messages, OnCall>;
  private fHooks: FasteHooks;

  constructor(state?: State, attrs?: Attributes, messages?: FasteMessageHandlers, hooks?: FasteHooks) {
    this.fState = state;
    this.fAttrs = attrs;
    // @ts-ignore
    this.fHandlers = messages || {} as FasteMessageHandlers;
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

  withPhases<T extends string>(phases?: T): Faste<State, Attributes, T | MAGIC_PHASES, Messages, Signals> {
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

const m = faste();

const f = m
  .withState({
    nextState: 'unknown'
  })
  .withAttrs({
    node: 12
  })
  .withMessages(['a', 'b', 'message'])
  .hooks({
    "a": {
      on: () => ({obj3: 42}),
      off: (state, prev) => prev.obj,
    }
  })
  .on('message', ({state, transitTo, attrs}) => transitTo(state.nextState))
  .on('message', ['onState2'], ({state, transitTo}) => transitTo(state.nextState))
  .create();

f
  .attrs({
    node: 14
  })
  .start("state1")
  .put("message")