import { describe, expect, test } from "bun:test";
import {
  bytesToBase64Url,
  pairingSecretKeyFromHex,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "@khoralabs/relay-crypto";
import {
  createEncryptingMlsStatePersistence,
  encodeKeyPackageWire,
  generateDidBoundKeyPackage,
  KeyPackageManager,
  MemoryMlsStatePersistence,
} from "@khoralabs/relay-mls";
import { signAsync } from "@noble/ed25519";
import { getCiphersuiteFromName, nobleCryptoProvider } from "ts-mls";

import { createTestAgent, createTestRelayApp, signedFetch } from "./testing";

async function publishTestKeyPackages(
  base: string,
  agent: Awaited<ReturnType<typeof createTestAgent>>,
  count: number,
): Promise<void> {
  const cs = await nobleCryptoProvider.getCiphersuiteImpl(
    getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
  );
  const packages: string[] = [];
  for (let i = 0; i < count; i++) {
    const kp = await generateDidBoundKeyPackage(agent.did, agent.privateKey, cs);
    packages.push(bytesToBase64Url(encodeKeyPackageWire(kp.publicPackage)));
  }
  const path = "/v1/key-packages";
  const bodyText = JSON.stringify({ keyPackages: packages });
  const res = await signedFetch(base, {
    method: "POST",
    path,
    bodyText,
    privateKey: agent.privateKey,
    did: agent.did,
  });
  expect(res.ok).toBe(true);
}

describe("key-packages", () => {
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
    await publishTestKeyPackages(base, victim, 2);

    const unauth = await fetch(`${base}/v1/key-packages/${encodeURIComponent(victim.did)}`);
    expect(unauth.ok).toBe(false);

    const requester = await createTestAgent();
    const path = `/v1/key-packages/${encodeURIComponent(victim.did)}`;
    const authed = await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    expect(authed.ok).toBe(true);
    const body = (await authed.json()) as {
      keyPackage: string;
      remainingKeyPackages: number;
      keyPackageDepleted: boolean;
    };
    expect(body.keyPackage.length).toBeGreaterThan(0);
    expect(body.remainingKeyPackages).toBe(1);
    expect(body.keyPackageDepleted).toBe(false);

    server.stop();
    cleanup();
  });

  test("depleted pool reports explicit metadata", async () => {
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
    await publishTestKeyPackages(base, victim, 1);

    const requester = await createTestAgent();
    const path = `/v1/key-packages/${encodeURIComponent(victim.did)}`;
    await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    const second = await signedFetch(base, {
      method: "GET",
      path,
      privateKey: requester.privateKey,
      did: requester.did,
    });
    expect(second.ok).toBe(false);

    server.stop();
    cleanup();
  });

  test("KeyPackageManager auto-replenishes low pool", async () => {
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
    const manager = new KeyPackageManager({
      relayBaseUrl: base,
      signer: {
        did: owner.did,
        sign: (m) => signAsync(m, owner.privateKey),
      },
      myDid: owner.did,
      ed25519PrivateKey: owner.privateKey,
      minKeyPackages: 5,
      replenishBatchSize: 10,
    });
    await manager.replenishIfNeeded();
    const statusPath = "/v1/key-packages/status";
    const statusRes = await signedFetch(base, {
      method: "GET",
      path: statusPath,
      privateKey: owner.privateKey,
      did: owner.did,
    });
    const status = (await statusRes.json()) as { remainingKeyPackages: number };
    expect(status.remainingKeyPackages).toBe(10);

    server.stop();
    cleanup();
  });

  test("KeyPackageManager reloads persisted private keys after restart", async () => {
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
    const persistence = createEncryptingMlsStatePersistence(
      new MemoryMlsStatePersistence(),
      pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX),
    );
    const managerOpts = {
      relayBaseUrl: base,
      signer: {
        did: owner.did,
        sign: (m: Uint8Array) => signAsync(m, owner.privateKey),
      },
      myDid: owner.did,
      ed25519PrivateKey: owner.privateKey,
      persistence,
      minKeyPackages: 2,
      replenishBatchSize: 3,
    };
    const manager1 = new KeyPackageManager(managerOpts);
    await manager1.replenishIfNeeded();
    const firstList = await manager1.listStoredKeyPackages();
    expect(firstList.length).toBeGreaterThan(0);

    const manager2 = new KeyPackageManager(managerOpts);
    const reloaded = await manager2.listStoredKeyPackages();
    expect(reloaded.length).toBe(firstList.length);

    server.stop();
    cleanup();
  });
});
