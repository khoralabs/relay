import type { ChannelAdmissionStore } from "@khoralabs/relay/admission";
import type { NonceStore } from "../../nonce-store";
import type { RateLimiter, RateLimitRule } from "../../rate-limit";
import type { BlobSpool } from "../sqlite/blob-spool";
import type { ChannelRegistry } from "../sqlite/registry";

/** Ephemeral + optional durable factories. Redis/memory omit durable. */
export type RelayPersistenceStrategy = {
  readonly kind: "sqlite" | "redis" | "memory";
  createNonceStore(): NonceStore;
  createRateLimiter(rule: RateLimitRule | null): RateLimiter;
  /** SQLite only today */
  createAdmissionStore?(key: Uint8Array): ChannelAdmissionStore;
  createBlobSpool?(): BlobSpool;
  createChannelRegistry?(): ChannelRegistry;
};

/** Facade used by app / auth / rate-limit buckets — no Database. */
export type RelayPersistence = {
  admission: ChannelAdmissionStore;
  spool: BlobSpool;
  registry: ChannelRegistry;
  nonceStore: NonceStore;
  createRateLimiter(rule: RateLimitRule | null): RateLimiter;
};
