/** DID-authenticated relay signer — signs canonical agent-request bytes. */
export type RelaySigner = {
  readonly did: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
};

export type PersistableRelaySigner = RelaySigner & {
  export(): string;
};
