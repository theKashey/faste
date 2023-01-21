export type CallSignature<Name extends string> = {
  [k in Name]?: ReadonlyArray<any>;
};

export type DefaultSignatures = {
  '@enter': [newPhase: string];
  '@leave': [oldPhase: string];
  '@error': [error: Error];
  '@change': [oldState: any];
};

export type ExtractSignature<
  MessageSignatures,
  Message extends string
> = MessageSignatures extends CallSignature<Message> ? MessageSignatures[Message] : [];
