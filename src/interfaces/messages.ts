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
