import type { Database } from "bun:sqlite";
import { createRelayAuth, type RelayAuth } from "./auth";
import type { BlobSpool } from "./blob-spool";
import { createNonceStore } from "./create-nonce-store";
import type { RelayHttpDeps } from "./http/deps";
import { routeRelayHttp } from "./http/router";
import type { NonceStore } from "./nonce-store";
import {
  clientIpFromRequest,
  peerAddressFromRequest,
  relayTrustedProxyFromEnv,
} from "./rate-limit";
import { createRelayRateLimiters, type RelayRateLimiters } from "./rate-limit-buckets";
import type { ChannelRegistry } from "./registry";
import type { RelayProfile } from "./relay-config";
import { envRelayMaxChannels } from "./relay-env";
import { type RelayHub, type RelayHubWsData, relayHubWebSocketHandlers } from "./relay-hub";
import {
  createRelayRedisClient,
  relayRedisPrefixFromEnv,
  relayRedisUrlFromEnv,
} from "./relay-redis";
import { createRelayIngressLimiter, MAX_RELAY_WS_FRAME_BYTES } from "./relay-ws-limits";
import { type WsOriginPolicy, wsOriginPolicyFromEnv } from "./ws-origin-policy";

export { DEFAULT_CHANNEL_TTL_MS } from "./relay-config";

export type RelayWebSocketHandlers = ReturnType<typeof relayHubWebSocketHandlers>;

export type RelayWebSocketConfig = RelayWebSocketHandlers & {
  maxPayloadLength: number;
};

export type RelayApp = {
  hub: RelayHub;
  auth: RelayAuth;
  registry: ChannelRegistry;
  websocket: RelayWebSocketConfig;
  fetch(req: Request, server: Bun.Server<RelayHubWsData>): Promise<Response | undefined>;
};

export type CreateRelayAppOptions = {
  registry: ChannelRegistry;
  hub: RelayHub;
  spool: BlobSpool;
  db?: Database;
  auth?: RelayAuth | undefined;
  nonceStore?: NonceStore | undefined;
  rateLimiters?: RelayRateLimiters | undefined;
  relayProfile?: RelayProfile | undefined;
  now?: (() => number) | undefined;
  env?: NodeJS.ProcessEnv;
  wsOriginPolicy?: WsOriginPolicy | undefined;
};

export function createRelayApp(opts: CreateRelayAppOptions): RelayApp {
  const env = opts.env ?? process.env;
  const redisUrl = relayRedisUrlFromEnv(env);
  const redisPrefix = relayRedisPrefixFromEnv(env);
  const redis = redisUrl !== undefined ? createRelayRedisClient(redisUrl) : undefined;
  const backing = { db: opts.db, redis, redisPrefix };

  const ingressLimiter = createRelayIngressLimiter();
  const wsHandlers = relayHubWebSocketHandlers({ hub: opts.hub, ingressLimiter });
  const nonceStore = opts.nonceStore ?? createNonceStore(backing);
  const auth =
    opts.auth ??
    createRelayAuth({
      now: opts.now,
      nonceStore,
    });
  const rateLimiters = opts.rateLimiters ?? createRelayRateLimiters(env, backing);
  const now = opts.now ?? (() => Date.now());
  const trustedProxy = relayTrustedProxyFromEnv(env);
  const wsOriginPolicy = opts.wsOriginPolicy ?? wsOriginPolicyFromEnv(env);
  const clientIp = (req: Request, server?: Bun.Server<unknown>) =>
    clientIpFromRequest(req, {
      trustedProxy,
      peerAddress: peerAddressFromRequest(server, req),
    });

  const relayProfile =
    opts.relayProfile ??
    ({ mode: "pool", maxRelayChannels: envRelayMaxChannels() } satisfies RelayProfile);

  const httpDeps: RelayHttpDeps = {
    hub: opts.hub,
    spool: opts.spool,
    registry: opts.registry,
    auth,
    rateLimiters,
    relayProfile,
    now,
    trustedProxy,
    clientIp,
    wsOriginPolicy,
  };

  return {
    hub: opts.hub,
    auth,
    registry: opts.registry,
    websocket: {
      ...wsHandlers,
      maxPayloadLength: MAX_RELAY_WS_FRAME_BYTES,
    },
    fetch(req, server) {
      return routeRelayHttp(httpDeps, req, server);
    },
  };
}
