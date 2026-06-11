import { createRelayAuth, type RelayAuth } from "./auth";
import type { BlobSpool } from "./blob-spool";
import type { RelayHttpDeps } from "./http/deps";
import { routeRelayHttp } from "./http/router";
import { createRelayRateLimiters, type RelayRateLimiters } from "./rate-limit-buckets";
import type { ChannelRegistry } from "./registry";
import type { RelayProfile } from "./relay-config";
import { envRelayMaxChannels } from "./relay-env";
import { type RelayHub, type RelayHubWsData, relayHubWebSocketHandlers } from "./relay-hub";
import { createRelayIngressLimiter, MAX_RELAY_WS_FRAME_BYTES } from "./relay-ws-limits";

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
  auth?: RelayAuth | undefined;
  rateLimiters?: RelayRateLimiters | undefined;
  relayProfile?: RelayProfile | undefined;
  now?: (() => number) | undefined;
};

export function createRelayApp(opts: CreateRelayAppOptions): RelayApp {
  const ingressLimiter = createRelayIngressLimiter();
  const wsHandlers = relayHubWebSocketHandlers({ hub: opts.hub, ingressLimiter });
  const auth = opts.auth ?? createRelayAuth({ now: opts.now });
  const rateLimiters = opts.rateLimiters ?? createRelayRateLimiters();
  const now = opts.now ?? (() => Date.now());

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
