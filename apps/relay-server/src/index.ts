import {
  bootstrapSingleChannel,
  createChannelRegistry,
  createRelayApp,
  createRelayHub,
  createRelayStores,
  loadRelayProfile,
  openRelayDatabase,
} from "@khoralabs/relay/server";

const DEFAULT_PORT = 8790;

function envPort(): number {
  const raw = process.env.PORT?.trim();
  if (raw === undefined || raw.length === 0) return DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_PORT;
}

const relayProfile = loadRelayProfile();
const db = openRelayDatabase();
const stores = createRelayStores(db);
const hub = createRelayHub({ admission: stores.admission, spool: stores.spool });
const registry = createChannelRegistry(db);

if (relayProfile.mode === "single") {
  await bootstrapSingleChannel({ hub, registry, config: relayProfile.config });
}

const app = createRelayApp({
  registry,
  hub,
  spool: stores.spool,
  relayProfile,
});

const server = Bun.serve({
  port: envPort(),
  fetch(req, srv) {
    return app.fetch(req, srv);
  },
  websocket: app.websocket,
});

const modeLabel =
  relayProfile.mode === "single" ? `single channel ${relayProfile.config.channelId}` : "pool";
console.log(`relay-server (${modeLabel}) listening on :${server.port}`);
