export type RelaySigner = {
  readonly did: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
};
