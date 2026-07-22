import { expect, test } from "bun:test";
import { connectRelay } from "@khoralabs/relay/client";
import { relayWsUpgradeProtocol } from "@khoralabs/relay/contracts";
import {
  createTestAgent,
  createTestRelayApp,
  signedFetch,
  signedPath,
} from "@khoralabs/relay/testing";

function serve(app: Awaited<ReturnType<typeof createTestRelayApp>>["app"]) {
  return Bun.serve({
    port: 0,
    fetch(req, srv) {
      return app.fetch(req, srv);
    },
    websocket: app.websocket,
  });
}

test("create → invite join → WS blob fan-out", async () => {
  const { app, cleanup } = await createTestRelayApp();
  const server = serve(app);
  const base = `http://127.0.0.1:${server.port}`;
  const creator = await createTestAgent();
  const peer = await createTestAgent();

  const createRes = await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels"),
    bodyText: "{}",
    privateKey: creator.privateKey,
    did: creator.did,
  });
  expect(createRes.ok).toBe(true);
  const created = (await createRes.json()) as {
    channelId: string;
    inviteToken: string;
    ticket: string;
    webSocketUrl: string;
    upgradeNonce: string;
  };

  const joinRes = await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels/join"),
    bodyText: JSON.stringify({ inviteToken: created.inviteToken }),
    privateKey: peer.privateKey,
    did: peer.did,
  });
  expect(joinRes.ok).toBe(true);
  const joined = (await joinRes.json()) as {
    webSocketUrl: string;
    upgradeNonce: string;
    ticket: string;
  };

  const received: Uint8Array[] = [];
  const conn = connectRelay({
    webSocketUrl: joined.webSocketUrl,
    upgradeNonce: joined.upgradeNonce,
    onBlob: (blob) => received.push(blob),
  });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ws timeout")), 5_000);
    const ws = new WebSocket(created.webSocketUrl, [relayWsUpgradeProtocol(created.upgradeNonce)]);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      const payload = new TextEncoder().encode("hello-blob");
      ws.send(payload);
      setTimeout(() => {
        clearTimeout(t);
        ws.close();
        resolve();
      }, 200);
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws error"));
    };
  });

  expect(received.length).toBeGreaterThan(0);
  expect(new TextDecoder().decode(received[0] as Uint8Array)).toBe("hello-blob");
  conn.close();
  server.stop();
  cleanup();
});

test("session allocate / status / release", async () => {
  const { app, cleanup } = await createTestRelayApp();
  const server = serve(app);
  const base = `http://127.0.0.1:${server.port}`;
  const creator = await createTestAgent();
  const peer = await createTestAgent();

  const createRes = await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels"),
    bodyText: "{}",
    privateKey: creator.privateKey,
    did: creator.did,
  });
  const created = (await createRes.json()) as { channelId: string; inviteToken: string };

  await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels/join"),
    bodyText: JSON.stringify({ inviteToken: created.inviteToken }),
    privateKey: peer.privateKey,
    did: peer.did,
  });

  const sessionId = crypto.randomUUID();
  const allocRes = await signedFetch(base, {
    method: "POST",
    path: signedPath(`/v1/channels/${created.channelId}/sessions/allocate`),
    bodyText: JSON.stringify({ counterpartyDid: peer.did, sessionId }),
    privateKey: creator.privateKey,
    did: creator.did,
  });
  expect(allocRes.ok).toBe(true);

  const statusRes = await signedFetch(base, {
    method: "GET",
    path: signedPath(`/v1/channels/${created.channelId}/sessions/${sessionId}`),
    bodyText: "",
    privateKey: creator.privateKey,
    did: creator.did,
  });
  expect(statusRes.ok).toBe(true);

  const releaseRes = await signedFetch(base, {
    method: "POST",
    path: signedPath(`/v1/channels/${created.channelId}/sessions/${sessionId}/release`),
    bodyText: "",
    privateKey: creator.privateKey,
    did: creator.did,
  });
  expect(releaseRes.ok).toBe(true);

  server.stop();
  cleanup();
});

test("hub fans out to 3 simultaneous peers", async () => {
  const { app, cleanup } = await createTestRelayApp();
  const server = serve(app);
  const base = `http://127.0.0.1:${server.port}`;
  const creator = await createTestAgent();
  const peerB = await createTestAgent();
  const peerC = await createTestAgent();

  const createRes = await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels"),
    bodyText: JSON.stringify({ enableSpool: true }),
    privateKey: creator.privateKey,
    did: creator.did,
  });
  expect(createRes.ok).toBe(true);
  const created = (await createRes.json()) as {
    channelId: string;
    inviteToken: string;
    webSocketUrl: string;
    upgradeNonce: string;
  };

  for (const peer of [peerB, peerC]) {
    const tokenRes = await signedFetch(base, {
      method: "POST",
      path: signedPath(`/v1/channels/${created.channelId}/join-tokens`),
      bodyText: "{}",
      privateKey: creator.privateKey,
      did: creator.did,
    });
    expect(tokenRes.ok).toBe(true);
    const { joinToken } = (await tokenRes.json()) as { joinToken: string };
    const joinRes = await signedFetch(base, {
      method: "POST",
      path: signedPath("/v1/channels/join"),
      bodyText: JSON.stringify({ inviteToken: joinToken }),
      privateKey: peer.privateKey,
      did: peer.did,
    });
    expect(joinRes.ok).toBe(true);
  }

  const ticketB = await signedFetch(base, {
    method: "POST",
    path: signedPath(`/v1/channels/${created.channelId}/ticket`),
    bodyText: "{}",
    privateKey: peerB.privateKey,
    did: peerB.did,
  });
  const ticketC = await signedFetch(base, {
    method: "POST",
    path: signedPath(`/v1/channels/${created.channelId}/ticket`),
    bodyText: "{}",
    privateKey: peerC.privateKey,
    did: peerC.did,
  });
  const joinedB = (await ticketB.json()) as { webSocketUrl: string; upgradeNonce: string };
  const joinedC = (await ticketC.json()) as { webSocketUrl: string; upgradeNonce: string };

  const receivedB: Uint8Array[] = [];
  const receivedC: Uint8Array[] = [];
  const connB = connectRelay({
    webSocketUrl: joinedB.webSocketUrl,
    upgradeNonce: joinedB.upgradeNonce,
    onBlob: (blob) => receivedB.push(blob),
  });
  const connC = connectRelay({
    webSocketUrl: joinedC.webSocketUrl,
    upgradeNonce: joinedC.upgradeNonce,
    onBlob: (blob) => receivedC.push(blob),
  });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ws timeout")), 5_000);
    const ws = new WebSocket(created.webSocketUrl, [relayWsUpgradeProtocol(created.upgradeNonce)]);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      ws.send(new TextEncoder().encode("fanout-blob"));
      setTimeout(() => {
        clearTimeout(t);
        ws.close();
        resolve();
      }, 300);
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error("ws error"));
    };
  });

  expect(receivedB.length).toBeGreaterThan(0);
  expect(receivedC.length).toBeGreaterThan(0);
  expect(new TextDecoder().decode(receivedB[0] as Uint8Array)).toBe("fanout-blob");
  expect(new TextDecoder().decode(receivedC[0] as Uint8Array)).toBe("fanout-blob");
  connB.close();
  connC.close();
  server.stop();
  cleanup();
});
