import { createRateLimiter, envRatePerMinute, type RateLimitCheck } from "./rate-limit";

export type RateLimiter = (key: string) => RateLimitCheck;

export type RelayRateLimiters = {
  channelsCreateDid: RateLimiter;
  channelsJoinDid: RateLimiter;
  channelsTicketMintDid: RateLimiter;
  channelsAllocateDid: RateLimiter;
  defaultIp: RateLimiter;
};

export function createRelayRateLimiters(env: NodeJS.ProcessEnv = process.env): RelayRateLimiters {
  return {
    channelsCreateDid: createRateLimiter(
      envRatePerMinute(env.RELAY_RL_CHANNELS_CREATE_PER_MIN_PER_DID, 30),
    ),
    channelsJoinDid: createRateLimiter(
      envRatePerMinute(env.RELAY_RL_CHANNELS_JOIN_PER_MIN_PER_DID, 30),
    ),
    channelsTicketMintDid: createRateLimiter(
      envRatePerMinute(env.RELAY_RL_CHANNELS_TICKET_PER_MIN_PER_DID, 60),
    ),
    channelsAllocateDid: createRateLimiter(
      envRatePerMinute(env.RELAY_RL_CHANNELS_ALLOCATE_PER_MIN_PER_DID, 60),
    ),
    defaultIp: createRateLimiter(envRatePerMinute(env.RELAY_RL_DEFAULT_PER_MIN_PER_IP, 900)),
  };
}
