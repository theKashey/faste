export type CallSignature<Name extends string> = {
  [k in Name]?: ReadonlyArray<any>;
};

export type EnterLeaveSignatures<Phases> = {
  '@enter': readonly [newPhase: Phases, oldPhase: Phases];
  '@leave': readonly [oldPhase: Phases, oldPhase: Phases];
};

export type DefaultSignatures = {
  // '@enter': readonly [newPhase: string];
  // '@leave': readonly [oldPhase: string];
  '@error': readonly [error: Error];
};

export type StateChangeSignature<State> = {
  '@change': readonly [oldState: State];
};

export type ExtractSignature<Signatures, Key extends string, Fallback = []> = Signatures extends CallSignature<Key>
  ? Signatures[Key]
  : Fallback;
