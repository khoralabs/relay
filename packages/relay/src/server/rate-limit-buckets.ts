import type { RelayPersistence } from "./persistence/core/types";
import { envRatePerMinute, type RateLimitCheck, type RateLimiter } from "./rate-limit";

export type RelayRateLimiters = {
  channelsCreateDid: RateLimiter;
  channelsJoinDid: RateLimiter;
  channelsTicketMintDid: RateLimiter;
  channelsAllocateDid: RateLimiter;
  keyPackageFetchDid: RateLimiter;
  defaultIp: RateLimiter;
};

export function createRelayRateLimiters(
  env: NodeJS.ProcessEnv = process.env,
  persistence: Pick<RelayPersistence, "createRateLimiter">,
): RelayRateLimiters {
  const create = (raw: string | undefined, defaultMax: number) =>
    persistence.createRateLimiter(envRatePerMinute(raw, defaultMax));

  return {
    channelsCreateDid: create(env.RELAY_RL_CHANNELS_CREATE_PER_MIN_PER_DID, 30),
    channelsJoinDid: create(env.RELAY_RL_CHANNELS_JOIN_PER_MIN_PER_DID, 30),
    channelsTicketMintDid: create(env.RELAY_RL_CHANNELS_TICKET_PER_MIN_PER_DID, 60),
    channelsAllocateDid: create(env.RELAY_RL_CHANNELS_ALLOCATE_PER_MIN_PER_DID, 60),
    keyPackageFetchDid: create(env.RELAY_RL_KEY_PACKAGES_FETCH_PER_MIN_PER_DID, 30),
    defaultIp: create(env.RELAY_RL_DEFAULT_PER_MIN_PER_IP, 900),
  };
}

export type { RateLimitCheck };
