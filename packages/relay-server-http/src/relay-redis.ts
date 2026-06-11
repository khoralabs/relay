import { RedisClient } from "bun";

export function relayRedisUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.RELAY_REDIS_URL?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw;
  }
  return undefined;
}

export function relayRedisPrefixFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.RELAY_REDIS_PREFIX?.trim();
  if (raw !== undefined && raw.length > 0) {
    return raw;
  }
  return "relay";
}

export function createRelayRedisClient(url: string): RedisClient {
  return new RedisClient(url);
}

export type RelayRedisClient = RedisClient;
