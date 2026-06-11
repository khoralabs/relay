import type { RelayAuth } from "../auth";
import type { RelayRateLimiters } from "../rate-limit-buckets";
import type { ChannelRegistry } from "../registry";
import type { RelayProfile } from "../relay-config";
import type { RelayHub } from "../relay-hub";

export type RelayHttpDeps = {
  hub: RelayHub;
  registry: ChannelRegistry;
  auth: RelayAuth;
  rateLimiters: RelayRateLimiters;
  relayProfile: RelayProfile;
  now: () => number;
};
