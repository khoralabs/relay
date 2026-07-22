import { expect, test } from "bun:test";
import {
  createInMemoryRateLimiter,
  createRelayApp,
  createRelayRateLimiters,
} from "@khoralabs/relay/server";
import {
  createTestAgent,
  createTestRelayApp,
  signedFetch,
  signedPath,
} from "@khoralabs/relay/testing";

test("rate limiter returns 429", async () => {
  const limiter = createInMemoryRateLimiter({ windowMs: 60_000, max: 1 });
  const first = await limiter("k");
  const second = await limiter("k");
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.retryAfterSec).toBeGreaterThan(0);
});

test("channels create rate limit → 429", async () => {
  const { app, spool, persistence, cleanup } = await createTestRelayApp();
  const limitedApp = createRelayApp({
    hub: app.hub,
    spool,
    persistence,
    auth: app.auth,
    rateLimiters: {
      ...createRelayRateLimiters(process.env, persistence),
      channelsCreateDid: createInMemoryRateLimiter({ windowMs: 60_000, max: 1 }),
    },
  });
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      return limitedApp.fetch(req, srv);
    },
    websocket: limitedApp.websocket,
  });

  const base = `http://127.0.0.1:${server.port}`;
  const agent = await createTestAgent();
  const path = signedPath("/v1/channels");

  const r1 = await signedFetch(base, {
    method: "POST",
    path,
    bodyText: "{}",
    privateKey: agent.privateKey,
    did: agent.did,
  });
  expect(r1.ok).toBe(true);

  const r2 = await signedFetch(base, {
    method: "POST",
    path,
    bodyText: "{}",
    privateKey: agent.privateKey,
    did: agent.did,
  });
  expect(r2.status).toBe(429);
  server.stop();
  cleanup();
}, 15_000);
