import { FasteInstance } from './faste-executor';
import { OnCallback } from './interfaces/callbacks';
import { GuardCallback, Guards } from './interfaces/guards';
import { Hooks } from './interfaces/hooks';
import { MessageHandlers } from './interfaces/messages';
import { MAGIC_EVENTS } from './types';

export type PhaseTransition<T extends string, K> = { [key in T]: K };

export type PhaseTransitionSetup<K extends string, T extends PhaseTransition<K, Partial<K>>> = {
  [key in keyof T]: T[key][];
};

type FasteTimers<TimerNames extends string> = Record<TimerNames, number>;

/**
 * The Faste machine
 * @name Faste
 */
export class Faste<
  State extends object = never,
  Attributes extends object = never,
  Phases extends string = never,
  Transitions extends PhaseTransition<Phases, Partial<Phases>> = PhaseTransition<Phases, Phases>,
  Messages extends string = MAGIC_EVENTS,
  Signals extends string = never,
  Timers extends string = never,
  FasteHooks = Hooks<State, Attributes, Phases, Timers>,
  OnCall = OnCallback<State, Attributes, Phases, Messages, Signals, Timers>,
  FasteMessageHandlers = MessageHandlers<State, Attributes, Phases, Messages, OnCall>
> {
  private fState: State;
  private fAttrs: Attributes;
  private fHandlers: MessageHandlers<State, Attributes, Phases, Messages, OnCall>;
  private fHooks: FasteHooks;

  private fTimers: FasteTimers<Timers>;
  private fGuards: Guards<State, Phases, Attributes>;

  constructor(
    state?: State,
    attrs?: Attributes,
    messages?: FasteMessageHandlers,
    hooks?: FasteHooks,
    guards?: Guards<State, Phases, Attributes>,
    timers?: FasteTimers<Timers>
  ) {
    this.fState = state;
    this.fAttrs = attrs;
    this.fHandlers = messages || ({} as any);
    this.fHooks = hooks || ({} as FasteHooks);
    this.fGuards = guards || [];
    this.fTimers = timers || ({} as FasteTimers<Timers>);
  }

  private _alter({ state, attrs, timers }: { state?: any; attrs?: any; timers?: any }): any {
    return new Faste(
      state || this.fState,
      attrs || this.fAttrs,
      this.fHandlers,
      this.fHooks,
      this.fGuards as any,
      timers || this.fTimers
    );
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
    callback: OnCallback<State, Attributes, Transitions[K], Messages, Signals, Timers>
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

  private _addHandler(eventName: Messages, phases: Phases[], callback: OnCall): this {
    this.fHandlers[eventName] = this.fHandlers[eventName] || [];

    this.fHandlers[eventName].push({
      phases,
      callback,
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
  public hooks(hooks: Hooks<State, Attributes, Messages, Timers>): this {
    Object.assign(this.fHooks, hooks);

    return this;
  }

  /**
   * Adds a guard, which may block transition TO the phase
   * @param {String[]} state
   * @param callback
   */
  public guard(state: Phases[], callback: GuardCallback<State, Attributes>): this {
    this.fGuards.push({ state, callback, trap: false });

    return this;
  }

  /**
   * Add a trap, which may block transition FROM the phase
   * @param state
   * @param callback
   */
  public trap(state: Phases[], callback: GuardCallback<State, Attributes>): this {
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
    Guards<State, Phases, Attributes>,
    Timers
  > {
    return new FasteInstance(
      {
        state: this.fState,
        attrs: this.fAttrs,
        phase: undefined,
        instance: undefined,
        timers: this.fTimers,
      },
      {
        handlers: this.fHandlers,
        hooks: this.fHooks,
        guards: this.fGuards,
      }
    ); // as any
  }

  /**
   * Defines the State
   * @param state
   */
  withState<T extends object>(state?: T): Faste<T, Attributes, Phases, Transitions, Messages, Signals> {
    return this._alter({ state });
  }

  /**
   * Defines the Attributes
   * @param attributes
   */
  withAttrs<T extends object>(attributes?: T): Faste<State, T, Phases, Transitions, Messages, Signals> {
    return this._alter({ attrs: attributes });
  }

  /**
   * Defines possible Phases
   * @param phases
   */
  withPhases<T extends string>(phases?: T[]): Faste<State, Attributes, T, PhaseTransition<T, T>, Messages, Signals> {
    return this._alter({});
  }

  /**
   * Defines possible Phases Transitions
   * @param transitions
   */
  withTransitions<T extends PhaseTransition<Phases, Partial<Phases>>>(
    transitions: PhaseTransitionSetup<Phases, T>
  ): Faste<State, Attributes, Phases, T, Messages, Signals> {
    return this._alter({});
  }

  /**
   * Defines possible "in" events
   * @param messages
   */
  withMessages<T extends string>(
    messages?: T[]
  ): Faste<State, Attributes, Phases, Transitions, T | MAGIC_EVENTS, Signals> {
    return this._alter({});
  }

  /**
   * Defines possible "out" events
   * @param signals
   */
  withSignals<T extends string>(signals?: T[]): Faste<State, Attributes, Phases, Transitions, Messages, T> {
    return this._alter({});
  }

  withTimers<T extends string>(
    timers: Record<T, number>
  ): Faste<State, Attributes, Phases, Transitions, Messages | `on_${T}`, Signals, T> {
    return this._alter({ timers });
  }
}
