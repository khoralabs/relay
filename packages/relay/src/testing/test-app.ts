import { type BlobSpool, createRelayApp, type RelayApp, type RelayPersistence } from "../server";
import {
  bootstrapSingleChannel,
  type RelayProfile,
  type SingleChannelConfig,
} from "../server/relay-config";
import { envRelayMaxChannels } from "../server/relay-env";
import { createRelayHub } from "../server/relay-hub";
import type { WsOriginPolicy } from "../server/ws-origin-policy";
import { createDefaultTestPersistence } from "./default-persistence";

export type CreateTestRelayAppOptions = {
  /** Injected persistence. When omitted, an ephemeral in-process default is used. */
  persistence?: RelayPersistence;
  /** Extra cleanup when providing custom `persistence` (default harness cleans itself). */
  cleanup?: () => void;
  relayProfile?: RelayProfile;
  singleBootstrap?: SingleChannelConfig;
  env?: NodeJS.ProcessEnv;
  wsOriginPolicy?: WsOriginPolicy;
};

export type TestRelayApp = {
  app: RelayApp;
  spool: BlobSpool;
  persistence: RelayPersistence;
  cleanup(): void;
};

export async function createTestRelayApp(opts?: CreateTestRelayAppOptions): Promise<TestRelayApp> {
  const owned =
    opts?.persistence === undefined ? createDefaultTestPersistence(opts?.env) : undefined;
  const persistence = opts?.persistence ?? owned?.persistence;
  const hub = createRelayHub({ admission: persistence.admission, spool: persistence.spool });

  let relayProfile: RelayProfile =
    opts?.relayProfile ??
    ({ mode: "pool", maxRelayChannels: envRelayMaxChannels() } satisfies RelayProfile);

  if (opts?.singleBootstrap !== undefined) {
    relayProfile = { mode: "single", config: opts.singleBootstrap };
  }

  if (relayProfile.mode === "single") {
    await bootstrapSingleChannel({
      hub,
      registry: persistence.registry,
      config: relayProfile.config,
    });
  }

  const app = createRelayApp({
    hub,
    spool: persistence.spool,
    persistence,
    relayProfile,
    env: opts?.env,
    wsOriginPolicy: opts?.wsOriginPolicy,
  });

  return {
    app,
    spool: persistence.spool,
    persistence,
    cleanup() {
      owned?.cleanup();
      opts?.cleanup?.();
    },
  };
}
