import type { RelaySigner } from "@khoralabs/relay-contracts";
import {
  generateOneTimePreKeys,
  generateSignedPreKey,
  identityPublicKeyHexFromPriv,
  type PreKeyBundleStatus,
} from "@khoralabs/relay-crypto";

import { appendOneTimePreKeysHttp, getPreKeyStatusHttp, publishPreKeysHttp } from "./channels";

const DEFAULT_MIN_ONE_TIME_PREKEYS = 10;
const DEFAULT_REPLENISH_BATCH_SIZE = 50;
const DEFAULT_AUTO_REPLENISH_INTERVAL_MS = 60_000;

export type PreKeyManagerOptions = {
  relayBaseUrl: string;
  signer: RelaySigner;
  /** Ed25519 identity private key (32-byte seed). */
  identityPriv: Uint8Array;
  /** Replenish when unclaimed OTK count falls below this. */
  minOneTimePreKeys?: number;
  /** How many OTKs to generate per replenish or initial publish. */
  replenishBatchSize?: number;
};

/**
 * Holds local prekey material and replenishes the relay bundle when OTKs run low.
 * The relay cannot generate keys — this must run where the identity private key lives.
 */
export class PreKeyManager {
  private readonly minOneTimePreKeys: number;
  private readonly replenishBatchSize: number;
  private replenishTimer: ReturnType<typeof setInterval> | undefined;
  private spkPriv: Uint8Array | undefined;
  private otkPrivs = new Map<number, Uint8Array>();

  constructor(private readonly opts: PreKeyManagerOptions) {
    this.minOneTimePreKeys = opts.minOneTimePreKeys ?? DEFAULT_MIN_ONE_TIME_PREKEYS;
    this.replenishBatchSize = opts.replenishBatchSize ?? DEFAULT_REPLENISH_BATCH_SIZE;
  }

  /** Publish a full bundle when none exists, or append OTKs when below threshold. */
  async replenishIfNeeded(): Promise<PreKeyBundleStatus> {
    const status = await getPreKeyStatusHttp(this.opts.relayBaseUrl, this.opts.signer);
    if (!status.published) {
      await this.publishFullBundle();
      return await getPreKeyStatusHttp(this.opts.relayBaseUrl, this.opts.signer);
    }
    if (status.remainingOneTimePreKeys >= this.minOneTimePreKeys) {
      return status;
    }

    const needed = this.minOneTimePreKeys - status.remainingOneTimePreKeys;
    const count = Math.max(needed, this.replenishBatchSize);
    const generated = generateOneTimePreKeys(count, status.nextOneTimePreKeyId);
    for (const entry of generated) {
      this.otkPrivs.set(entry.bundle.keyId, entry.priv);
    }
    await appendOneTimePreKeysHttp(this.opts.relayBaseUrl, this.opts.signer, {
      oneTimePreKeys: generated.map((entry) => entry.bundle),
    });
    return await getPreKeyStatusHttp(this.opts.relayBaseUrl, this.opts.signer);
  }

  /** Poll and replenish on an interval (e.g. while a relay-hosted agent is online). */
  startAutoReplenish(intervalMs = DEFAULT_AUTO_REPLENISH_INTERVAL_MS): void {
    if (this.replenishTimer !== undefined) return;
    this.replenishTimer = setInterval(() => {
      void this.replenishIfNeeded().catch((e) => {
        console.warn("[relay-client] prekey auto-replenish failed:", e);
      });
    }, intervalMs);
  }

  stopAutoReplenish(): void {
    if (this.replenishTimer === undefined) return;
    clearInterval(this.replenishTimer);
    this.replenishTimer = undefined;
  }

  signedPreKeyPrivate(): Uint8Array | undefined {
    return this.spkPriv;
  }

  oneTimePreKeyPrivate(keyId: number): Uint8Array | undefined {
    return this.otkPrivs.get(keyId);
  }

  private async publishFullBundle(): Promise<void> {
    const identityKey = await identityPublicKeyHexFromPriv(this.opts.identityPriv);
    const spkId = 1;
    const { bundle: signedPreKey, priv: spkPriv } = await generateSignedPreKey(
      this.opts.identityPriv,
      spkId,
    );
    const generated = generateOneTimePreKeys(this.replenishBatchSize);
    this.spkPriv = spkPriv;
    this.otkPrivs.clear();
    for (const entry of generated) {
      this.otkPrivs.set(entry.bundle.keyId, entry.priv);
    }
    await publishPreKeysHttp(this.opts.relayBaseUrl, this.opts.signer, {
      identityKey,
      signedPreKey,
      oneTimePreKeys: generated.map((entry) => entry.bundle),
    });
  }
}
