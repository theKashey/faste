export type CallSignature<Name extends string> = {
  [k in Name]?: ReadonlyArray<any>;
};

export type DefaultSignatures = {
  '@enter': readonly [newPhase: string];
  '@leave': readonly [oldPhase: string];
  '@error': readonly [error: Error];
};

export type StateChangeSignature<State> = {
  '@change': [oldState: State];
};

export type ExtractSignature<Signatures, Key extends string> = Signatures extends CallSignature<Key>
  ? Signatures[Key]
  : [];
