import type { RelaySigner } from "@khoralabs/relay/contracts";
import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay/crypto";
import type { KeyPackage, PrivateKeyPackage } from "ts-mls";
import type { KeyPackageStoreEntry } from "./key-package-store";
import { loadKeyPackageStore, saveKeyPackageStore } from "./key-package-store";
import { decodeKeyPackageWire, encodeKeyPackageWire } from "./key-package-wire";
import {
  appendKeyPackagesHttp,
  getKeyPackageStatusHttp,
  publishKeyPackagesHttp,
} from "./key-packages-http";
import type { MlsStatePersistenceAdapter } from "./persistence";
import { getRelayMlsCiphersuite } from "./relay-mls-ciphersuite";
import { generateDidBoundKeyPackage } from "./relay-mls-key-package";

const DEFAULT_MIN_KEY_PACKAGES = 10;
const DEFAULT_REPLENISH_BATCH_SIZE = 50;
const DEFAULT_AUTO_REPLENISH_INTERVAL_MS = 60_000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;
const DEFAULT_BACKOFF_BASE_MS = 5_000;

export type AutoReplenishOptions = {
  /** Delay between successful replenish checks. Default 60_000. */
  intervalMs?: number;
  /** Consecutive failures before giving up. Default 5. */
  maxConsecutiveFailures?: number;
  /** Base delay for exponential backoff after failures. Default 5_000. */
  backoffBaseMs?: number;
  /** Invoked after max consecutive failures; default calls `process.exit(1)`. */
  onGiveUp?: (error: unknown, attempts: number) => void;
};

export type KeyPackageManagerOptions = {
  relayBaseUrl: string;
  signer: RelaySigner;
  myDid: string;
  /** Raw 32-byte Ed25519 seed for the agent `did:key` (binds MLS leaf signature key to DID). */
  ed25519PrivateKey: Uint8Array;
  /** Encrypted persistence for KeyPackage private halves (same adapter as MLS group state). */
  persistence?: MlsStatePersistenceAdapter;
  minKeyPackages?: number;
  replenishBatchSize?: number;
};

export type StoredKeyPackage = {
  publicPackage: KeyPackage;
  privatePackage: PrivateKeyPackage;
};

function storedKeyPackageToEntry(stored: StoredKeyPackage): KeyPackageStoreEntry {
  const publicB64 = bytesToBase64Url(encodeKeyPackageWire(stored.publicPackage));
  return {
    publicB64,
    initPrivateKeyB64: bytesToBase64Url(stored.privatePackage.initPrivateKey),
    hpkePrivateKeyB64: bytesToBase64Url(stored.privatePackage.hpkePrivateKey),
    signaturePrivateKeyB64: bytesToBase64Url(stored.privatePackage.signaturePrivateKey),
  };
}

function keyPackageStoreEntryToStored(entry: KeyPackageStoreEntry): StoredKeyPackage {
  return {
    publicPackage: decodeKeyPackageWire(base64UrlToBytes(entry.publicB64)),
    privatePackage: {
      initPrivateKey: base64UrlToBytes(entry.initPrivateKeyB64),
      hpkePrivateKey: base64UrlToBytes(entry.hpkePrivateKeyB64),
      signaturePrivateKey: base64UrlToBytes(entry.signaturePrivateKeyB64),
    },
  };
}

/**
 * Holds local KeyPackage private state and replenishes the relay pool when depleted.
 * Private halves are persisted when `persistence` is set so restarts can still join.
 */
export class KeyPackageManager {
  private readonly minKeyPackages: number;
  private readonly replenishBatchSize: number;
  private autoReplenishActive = false;
  private autoReplenishIntervalMs = DEFAULT_AUTO_REPLENISH_INTERVAL_MS;
  private maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_FAILURES;
  private backoffBaseMs = DEFAULT_BACKOFF_BASE_MS;
  private onGiveUp: (error: unknown, attempts: number) => void = () => process.exit(1);
  private replenishTimeout: ReturnType<typeof setTimeout> | undefined;
  private consecutiveFailures = 0;
  private readonly privateByPublicB64 = new Map<string, StoredKeyPackage>();
  private lastResortPublicB64: string | undefined;
  private storeLoaded = false;

  constructor(private readonly opts: KeyPackageManagerOptions) {
    this.minKeyPackages = opts.minKeyPackages ?? DEFAULT_MIN_KEY_PACKAGES;
    this.replenishBatchSize = opts.replenishBatchSize ?? DEFAULT_REPLENISH_BATCH_SIZE;
  }

  async replenishIfNeeded(): Promise<void> {
    await this.ensureStoreLoaded();
    const status = await getKeyPackageStatusHttp(this.opts.relayBaseUrl, this.opts.signer);
    if (!status.published) {
      await this.ensureLastResort();
      await this.publishBatch(this.replenishBatchSize);
      return;
    }
    if (status.remainingKeyPackages === 0) {
      await this.ensureLastResort();
      await this.appendLastResortToPool();
    }
    if (status.remainingKeyPackages >= this.minKeyPackages) return;

    const needed = this.minKeyPackages - status.remainingKeyPackages;
    const count = Math.max(needed, this.replenishBatchSize);
    await this.appendBatch(count);
  }

  startAutoReplenish(
    options: number | AutoReplenishOptions = DEFAULT_AUTO_REPLENISH_INTERVAL_MS,
  ): void {
    if (this.autoReplenishActive) return;
    const opts = typeof options === "number" ? { intervalMs: options } : options;
    this.autoReplenishIntervalMs = opts.intervalMs ?? DEFAULT_AUTO_REPLENISH_INTERVAL_MS;
    this.maxConsecutiveFailures = opts.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
    this.backoffBaseMs = opts.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
    if (opts.onGiveUp !== undefined) this.onGiveUp = opts.onGiveUp;
    this.autoReplenishActive = true;
    this.consecutiveFailures = 0;
    void this.runAutoReplenishTick();
  }

  stopAutoReplenish(): void {
    if (!this.autoReplenishActive && this.replenishTimeout === undefined) return;
    this.autoReplenishActive = false;
    if (this.replenishTimeout !== undefined) {
      clearTimeout(this.replenishTimeout);
      this.replenishTimeout = undefined;
    }
  }

  private scheduleNextReplenish(delayMs: number): void {
    if (!this.autoReplenishActive) return;
    this.replenishTimeout = setTimeout(() => {
      this.replenishTimeout = undefined;
      void this.runAutoReplenishTick();
    }, delayMs);
  }

  private async runAutoReplenishTick(): Promise<void> {
    if (!this.autoReplenishActive) return;
    try {
      await this.replenishIfNeeded();
      if (!this.autoReplenishActive) return;
      this.consecutiveFailures = 0;
      this.scheduleNextReplenish(this.autoReplenishIntervalMs);
    } catch (e) {
      if (!this.autoReplenishActive) return;
      this.consecutiveFailures++;
      console.warn(
        `[relay-mls] key-package auto-replenish failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`,
        e,
      );
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.stopAutoReplenish();
        this.onGiveUp(e, this.consecutiveFailures);
        return;
      }
      const delayMs = this.backoffBaseMs * 2 ** (this.consecutiveFailures - 1);
      this.scheduleNextReplenish(delayMs);
    }
  }

  findStoredKeyPackage(publicPackage: KeyPackage): StoredKeyPackage | undefined {
    const b64 = bytesToBase64Url(encodeKeyPackageWire(publicPackage));
    return this.privateByPublicB64.get(b64);
  }

  async listStoredKeyPackages(): Promise<StoredKeyPackage[]> {
    await this.ensureStoreLoaded();
    return [...this.privateByPublicB64.values()];
  }

  private async ensureStoreLoaded(): Promise<void> {
    if (this.storeLoaded) return;
    if (this.opts.persistence !== undefined) {
      const store = await loadKeyPackageStore(this.opts.persistence);
      for (const entry of store.entries) {
        const stored = keyPackageStoreEntryToStored(entry);
        this.privateByPublicB64.set(entry.publicB64, stored);
      }
      this.lastResortPublicB64 = store.lastResortPublicB64;
    }
    this.storeLoaded = true;
  }

  private async persistStore(): Promise<void> {
    if (this.opts.persistence === undefined) return;
    const entries = [...this.privateByPublicB64.values()].map(storedKeyPackageToEntry);
    await saveKeyPackageStore(this.opts.persistence, {
      entries,
      lastResortPublicB64: this.lastResortPublicB64,
    });
  }

  private rememberStored(stored: StoredKeyPackage): string {
    const b64 = bytesToBase64Url(encodeKeyPackageWire(stored.publicPackage));
    this.privateByPublicB64.set(b64, stored);
    return b64;
  }

  /** Last-resort package: private half kept locally and re-published when the pool drains. */
  private async ensureLastResort(): Promise<void> {
    if (
      this.lastResortPublicB64 !== undefined &&
      this.privateByPublicB64.has(this.lastResortPublicB64)
    ) {
      return;
    }
    const cs = await getRelayMlsCiphersuite();
    const kp = await generateDidBoundKeyPackage(this.opts.myDid, this.opts.ed25519PrivateKey, cs);
    this.lastResortPublicB64 = this.rememberStored(kp);
    await this.persistStore();
  }

  private async appendLastResortToPool(): Promise<void> {
    if (this.lastResortPublicB64 === undefined) return;
    await appendKeyPackagesHttp(this.opts.relayBaseUrl, this.opts.signer, {
      keyPackages: [this.lastResortPublicB64],
    });
  }

  private async publishBatch(count: number): Promise<void> {
    const generated = await this.generateBatch(count);
    await publishKeyPackagesHttp(this.opts.relayBaseUrl, this.opts.signer, {
      keyPackages: generated.map((g) => bytesToBase64Url(encodeKeyPackageWire(g.publicPackage))),
    });
  }

  private async appendBatch(count: number): Promise<void> {
    const generated = await this.generateBatch(count);
    await appendKeyPackagesHttp(this.opts.relayBaseUrl, this.opts.signer, {
      keyPackages: generated.map((g) => bytesToBase64Url(encodeKeyPackageWire(g.publicPackage))),
    });
  }

  private async generateBatch(count: number): Promise<StoredKeyPackage[]> {
    const cs = await getRelayMlsCiphersuite();
    const out: StoredKeyPackage[] = [];
    for (let i = 0; i < count; i++) {
      const kp = await generateDidBoundKeyPackage(this.opts.myDid, this.opts.ed25519PrivateKey, cs);
      this.rememberStored(kp);
      out.push(kp);
    }
    await this.persistStore();
    return out;
  }
}
