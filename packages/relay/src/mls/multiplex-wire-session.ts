/**
 * Extract session_id from OBP multiplex length-prefixed wire bytes when possible.
 * Frames lack session_id; maintain p_hash → session_id from init / envelope traffic.
 */
export class MultiplexWireSessionRouter {
  private readonly tipToSession = new Map<string, string>();

  registerInit(sessionId: string, genesisHash: string): void {
    this.tipToSession.set(genesisHash, sessionId);
  }

  registerTip(sessionId: string, tipHash: string): void {
    this.tipToSession.set(tipHash, sessionId);
  }

  extractSessionId(wireBytes: Uint8Array): string | undefined {
    try {
      if (wireBytes.length < 4) return undefined;
      const len = new DataView(
        wireBytes.buffer,
        wireBytes.byteOffset,
        wireBytes.byteLength,
      ).getUint32(0, false);
      if (wireBytes.length < 4 + len) return undefined;
      const jsonBytes = wireBytes.subarray(4, 4 + len);
      const j = JSON.parse(new TextDecoder().decode(jsonBytes)) as unknown;
      if (typeof j !== "object" || j === null) return undefined;
      const o = j as Record<string, unknown>;

      if (o.init !== undefined && typeof o.init === "object" && o.init !== null) {
        const init = o.init as Record<string, unknown>;
        const sid = init.session_id;
        if (typeof sid === "string" && sid.length > 0) {
          const genesis = init.genesis_hash;
          if (typeof genesis === "string" && genesis.length > 0) {
            this.registerInit(sid, genesis);
          }
          return sid;
        }
      }

      if (o.session_envelope !== undefined && typeof o.session_envelope === "object") {
        const env = o.session_envelope as Record<string, unknown>;
        const sid = env.session_id;
        if (typeof sid === "string" && sid.length > 0) return sid;
      }

      const pHash = o.p_hash;
      if (typeof pHash === "string" && pHash.length > 0) {
        const sid = this.tipToSession.get(pHash);
        if (sid !== undefined) {
          const sig = o.sig;
          if (typeof sig === "string") {
            // next tip is hash(frame canonical) — register after send via registerTip from caller
          }
          return sid;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}
