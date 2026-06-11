import type { Database } from "bun:sqlite";
import { createRelayRateLimiterFromEnv } from "./create-rate-limiter";
import type { RateLimitCheck, RateLimiter } from "./rate-limit";
import type { RelayRedisClient } from "./relay-redis";

export type RelayRateLimiters = {
  channelsCreateDid: RateLimiter;
  channelsJoinDid: RateLimiter;
  channelsTicketMintDid: RateLimiter;
  channelsAllocateDid: RateLimiter;
  defaultIp: RateLimiter;
};

export function createRelayRateLimiters(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { db?: Database; redis?: RelayRedisClient; redisPrefix?: string },
): RelayRateLimiters {
  const backing = {
    db: opts?.db,
    redis: opts?.redis,
    redisPrefix: opts?.redisPrefix,
  };
  return {
    channelsCreateDid: createRelayRateLimiterFromEnv(
      env.RELAY_RL_CHANNELS_CREATE_PER_MIN_PER_DID,
      30,
      backing,
    ),
    channelsJoinDid: createRelayRateLimiterFromEnv(
      env.RELAY_RL_CHANNELS_JOIN_PER_MIN_PER_DID,
      30,
      backing,
    ),
    channelsTicketMintDid: createRelayRateLimiterFromEnv(
      env.RELAY_RL_CHANNELS_TICKET_PER_MIN_PER_DID,
      60,
      backing,
    ),
    channelsAllocateDid: createRelayRateLimiterFromEnv(
      env.RELAY_RL_CHANNELS_ALLOCATE_PER_MIN_PER_DID,
      60,
      backing,
    ),
    defaultIp: createRelayRateLimiterFromEnv(env.RELAY_RL_DEFAULT_PER_MIN_PER_IP, 900, backing),
  };
}

export type { RateLimitCheck };
