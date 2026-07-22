/** Replay-protection store for `(did, nonce)` pairs. */
export interface NonceStore {
  tryInsert(p: {
    did: string;
    nonce: string;
    expiresAtMs: number;
    nowMs: number;
  }): boolean | Promise<boolean>;
  sweepExpired(nowMs: number): number | Promise<number>;
}
