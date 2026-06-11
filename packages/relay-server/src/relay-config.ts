import {
  DEFAULT_RELAY_SESSION_QUOTA,
  parseRelaySessionQuota,
  type RelaySessionQuota,
} from "@khoralabs/relay-contracts";

import { MAX_CHANNEL_TTL_MS } from "./auth";
import type { ChannelRegistry } from "./registry";
import { envRelayMaxChannels } from "./relay-env";
import type { RelayHub } from "./relay-hub";

export const DEFAULT_CHANNEL_TTL_MS = 86_400_000;

export type SingleChannelConfig = {
  channelId: string;
  creatorDid: string;
  ttlMs: number;
  maxPopulation: number | null;
  maxSessions: RelaySessionQuota;
  enableSpool?: boolean;
};

export type RelayProfile =
  | { mode: "single"; config: SingleChannelConfig }
  | { mode: "pool"; maxRelayChannels: number };

function parseMaxPopulation(env: NodeJS.ProcessEnv): number | null {
  const raw = env.RELAY_MAX_POPULATION?.trim();
  if (raw === undefined || raw.length === 0) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("RELAY_MAX_POPULATION must be a positive integer when set");
  }
  return n;
}

function parseMaxSessions(env: NodeJS.ProcessEnv): RelaySessionQuota {
  const raw = env.RELAY_MAX_SESSIONS?.trim();
  if (raw === undefined || raw.length === 0) return DEFAULT_RELAY_SESSION_QUOTA;
  try {
    return parseRelaySessionQuota(JSON.parse(raw) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`RELAY_MAX_SESSIONS invalid: ${msg}`);
  }
}

export function loadRelayProfile(env: NodeJS.ProcessEnv = process.env): RelayProfile {
  const explicitMode = env.RELAY_MODE?.trim();
  const channelId = env.RELAY_CHANNEL_ID?.trim();

  if (explicitMode === "pool") {
    return { mode: "pool", maxRelayChannels: envRelayMaxChannels(env) };
  }

  if (channelId !== undefined && channelId.length > 0) {
    const creatorDid = env.RELAY_CHANNEL_CREATOR_DID?.trim();
    if (creatorDid === undefined || creatorDid.length === 0) {
      throw new Error("RELAY_CHANNEL_CREATOR_DID is required when RELAY_CHANNEL_ID is set");
    }
    const ttlRaw = env.RELAY_CHANNEL_TTL_MS?.trim();
    const ttlMs = Math.min(
      ttlRaw !== undefined && ttlRaw.length > 0
        ? Number.parseInt(ttlRaw, 10)
        : DEFAULT_CHANNEL_TTL_MS,
      MAX_CHANNEL_TTL_MS,
    );
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error("RELAY_CHANNEL_TTL_MS must be a positive integer when set");
    }
    return {
      mode: "single",
      config: {
        channelId,
        creatorDid,
        ttlMs,
        maxPopulation: parseMaxPopulation(env),
        maxSessions: parseMaxSessions(env),
      },
    };
  }

  if (explicitMode === "single") {
    throw new Error("RELAY_CHANNEL_ID is required for RELAY_MODE=single");
  }

  return { mode: "pool", maxRelayChannels: envRelayMaxChannels(env) };
}

export async function bootstrapSingleChannel(input: {
  hub: RelayHub;
  registry: ChannelRegistry;
  config: SingleChannelConfig;
  nowMs?: number;
}): Promise<void> {
  const nowMs = input.nowMs ?? Date.now();
  const { config } = input;
  await input.hub.createChannel(config.channelId, config.ttlMs, {
    enableSpool: config.enableSpool,
  });
  input.registry.insertChannel({
    channelId: config.channelId,
    creatorDid: config.creatorDid,
    admissionMode: "invite_only",
    maxPopulation: config.maxPopulation,
    maxSessions: config.maxSessions,
    expiresAtMs: nowMs + config.ttlMs,
    createdAtMs: nowMs,
  });
}
