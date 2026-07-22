import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRelayApp, type RelayApp } from "../server/app";
import { createRelayStores, DEV_SQLCIPHER_KEY, openRelayDatabase } from "../server/db";
import { createChannelRegistry } from "../server/registry";
import {
  bootstrapSingleChannel,
  type RelayProfile,
  type SingleChannelConfig,
} from "../server/relay-config";
import { envRelayMaxChannels } from "../server/relay-env";
import { createRelayHub } from "../server/relay-hub";

import type { WsOriginPolicy } from "../server/ws-origin-policy";

export async function createTestRelayApp(opts?: {
  relayProfile?: RelayProfile;
  singleBootstrap?: SingleChannelConfig;
  dbPath?: string;
  env?: NodeJS.ProcessEnv;
  wsOriginPolicy?: WsOriginPolicy;
}): Promise<{
  app: RelayApp;
  db: Database;
  spool: ReturnType<typeof createRelayStores>["spool"];
  cleanup(): void;
}> {
  let cleanupDir: string | undefined;
  const dbPath =
    opts?.dbPath ??
    (() => {
      cleanupDir = mkdtempSync(join(tmpdir(), "relay-test-"));
      return join(cleanupDir, "relay.sqlite");
    })();

  const db = openRelayDatabase(dbPath, DEV_SQLCIPHER_KEY);
  const stores = createRelayStores(db);
  const hub = createRelayHub({ admission: stores.admission, spool: stores.spool });
  const registry = createChannelRegistry(db);

  let relayProfile: RelayProfile =
    opts?.relayProfile ??
    ({ mode: "pool", maxRelayChannels: envRelayMaxChannels() } satisfies RelayProfile);

  if (opts?.singleBootstrap !== undefined) {
    relayProfile = { mode: "single", config: opts.singleBootstrap };
  }

  if (relayProfile.mode === "single") {
    await bootstrapSingleChannel({ hub, registry, config: relayProfile.config });
  }

  const app = createRelayApp({
    registry,
    hub,
    spool: stores.spool,
    db,
    relayProfile,
    env: opts?.env,
    wsOriginPolicy: opts?.wsOriginPolicy,
  });

  return {
    app,
    db,
    spool: stores.spool,
    cleanup() {
      db.close();
      if (cleanupDir !== undefined) {
        rmSync(cleanupDir, { recursive: true, force: true });
      }
    },
  };
}
