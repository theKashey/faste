export type CallSignature<Name extends string> = {
  [k in Name]?: ReadonlyArray<any>;
};

export type EnterLeaveSignatures<Phases> = {
  '@enter': readonly [oldPhase: Phases, newPhase: Phases];
  '@leave': readonly [newPhase: Phases, oldPhase: Phases];
};

export type DefaultSignatures = {
  // '@enter': readonly [newPhase: string];
  // '@leave': readonly [oldPhase: string];
  '@error': readonly [error: Error];
};

export type StateChangeSignature<State> = {
  '@change': readonly [oldState: State];
};

export type ExtractSignature<Signatures, Key extends string, Fallback extends ReadonlyArray<any> = []> =
  Signatures extends CallSignature<Key>
    ? NonNullable<Signatures[Key]> extends ReadonlyArray<any>
      ? NonNullable<Signatures[Key]>
      : Fallback
    : Fallback;
