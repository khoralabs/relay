import { describe, expect, test } from "bun:test";
import { PreKeyManager } from "@khoralabs/relay-client";
import { bytesToHex, generateOneTimePreKeys, generateSignedPreKey } from "@khoralabs/relay-crypto";
import { getPublicKeyAsync, signAsync } from "@noble/ed25519";

import { createTestAgent, createTestRelayApp, signedFetch } from "./testing";

async function publishTestBundle(
  base: string,
  agent: Awaited<ReturnType<typeof createTestAgent>>,
  otkCount: number,
): Promise<void> {
  const ik = await getPublicKeyAsync(agent.privateKey);
  const { bundle: spk } = await generateSignedPreKey(agent.privateKey, 1);
  const otks = generateOneTimePreKeys(otkCount).map((o) => o.bundle);
  const path = "/v1/prekeys";
  const bodyText = JSON.stringify({
    identityKey: bytesToHex(ik),
    signedPreKey: spk,
    oneTimePreKeys: otks,
  });
  const res = await signedFetch(base, {
    method: "POST",
    path,
    bodyText,
    privateKey: agent.privateKey,
    did: agent.did,
  });
  expect(res.ok).toBe(true);
}

describe("prekeys", () => {
  test("fetch requires DID-signed auth", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const victim = await createTestAgent();
    await publishTestBundle(base, victim, 2);

    const unauth = await fetch(`${base}/v1/prekeys/${encodeURIComponent(victim.did)}`);
    expect(unauth.ok).toBe(false);

    const requester = await createTestAgent();
    const path = `/v1/prekeys/${encodeURIComponent(victim.did)}`;
    const authed = await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    expect(authed.ok).toBe(true);
    const body = (await authed.json()) as {
      oneTimePreKey?: { keyId: number };
      remainingOneTimePreKeys: number;
      oneTimePreKeyDepleted: boolean;
    };
    expect(body.oneTimePreKey).toBeDefined();
    expect(body.remainingOneTimePreKeys).toBe(1);
    expect(body.oneTimePreKeyDepleted).toBe(false);

    server.stop();
    cleanup();
  });

  test("depleted OTK reports explicit metadata", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const victim = await createTestAgent();
    await publishTestBundle(base, victim, 1);

    const requester = await createTestAgent();
    const path = `/v1/prekeys/${encodeURIComponent(victim.did)}`;

    const first = await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    expect(first.ok).toBe(true);

    const second = await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    expect(second.ok).toBe(true);
    const body = (await second.json()) as {
      oneTimePreKey?: { keyId: number };
      remainingOneTimePreKeys: number;
      oneTimePreKeyDepleted: boolean;
    };
    expect(body.oneTimePreKey).toBeUndefined();
    expect(body.remainingOneTimePreKeys).toBe(0);
    expect(body.oneTimePreKeyDepleted).toBe(true);

    server.stop();
    cleanup();
  });

  test("status and append replenish without full republish", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const owner = await createTestAgent();
    await publishTestBundle(base, owner, 1);

    const statusRes = await signedFetch(base, {
      method: "GET",
      path: "/v1/prekeys/status",
      privateKey: owner.privateKey,
      did: owner.did,
    });
    expect(statusRes.ok).toBe(true);
    const status = (await statusRes.json()) as {
      published: boolean;
      remainingOneTimePreKeys: number;
      nextOneTimePreKeyId: number;
    };
    expect(status.published).toBe(true);
    expect(status.remainingOneTimePreKeys).toBe(1);
    expect(status.nextOneTimePreKeyId).toBe(2);

    const otks = generateOneTimePreKeys(3, status.nextOneTimePreKeyId).map((o) => o.bundle);
    const appendRes = await signedFetch(base, {
      method: "POST",
      path: "/v1/prekeys/otks",
      bodyText: JSON.stringify({ oneTimePreKeys: otks }),
      privateKey: owner.privateKey,
      did: owner.did,
    });
    expect(appendRes.ok).toBe(true);
    const appended = (await appendRes.json()) as { remainingOneTimePreKeys: number };
    expect(appended.remainingOneTimePreKeys).toBe(4);

    server.stop();
    cleanup();
  });

  test("PreKeyManager auto-replenishes low OTK pool", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const owner = await createTestAgent();
    const signer = {
      did: owner.did,
      sign: (message: Uint8Array) => signAsync(message, owner.privateKey),
    };
    const manager = new PreKeyManager({
      relayBaseUrl: base,
      signer,
      identityPriv: owner.privateKey,
      minOneTimePreKeys: 5,
      replenishBatchSize: 10,
    });

    const published = await manager.replenishIfNeeded();
    expect(published.remainingOneTimePreKeys).toBe(10);

    const path = `/v1/prekeys/${encodeURIComponent(owner.did)}`;
    for (let i = 0; i < 8; i++) {
      const requester = await createTestAgent();
      await signedFetch(base, {
        method: "GET",
        path,
        privateKey: requester.privateKey,
        did: requester.did,
      });
    }

    const replenished = await manager.replenishIfNeeded();
    expect(replenished.remainingOneTimePreKeys).toBeGreaterThanOrEqual(5);

    server.stop();
    cleanup();
  });
});
