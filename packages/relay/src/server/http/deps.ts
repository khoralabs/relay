import type { RelayAuth } from "../auth";
import type { BlobSpool } from "../blob-spool";
import type { RelayRateLimiters } from "../rate-limit-buckets";
import type { ChannelRegistry } from "../registry";
import type { RelayProfile } from "../relay-config";
import type { RelayHub } from "../relay-hub";
import type { WsOriginPolicy } from "../ws-origin-policy";

export type RelayHttpDeps = {
  hub: RelayHub;
  spool: BlobSpool;
  registry: ChannelRegistry;
  auth: RelayAuth;
  rateLimiters: RelayRateLimiters;
  relayProfile: RelayProfile;
  now: () => number;
  trustedProxy: boolean;
  clientIp(req: Request, server?: Bun.Server<unknown>): string;
  wsOriginPolicy: WsOriginPolicy;
};
