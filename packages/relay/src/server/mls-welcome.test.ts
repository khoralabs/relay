import { describe, expect, test } from "bun:test";
import { bytesToBase64Url } from "@khoralabs/relay/crypto";

import { createTestAgent, createTestRelayApp, signedFetch, signedPath } from "../testing";

async function pairWithLexicographicInitiator() {
  let initiator = await createTestAgent();
  let counterparty = await createTestAgent();
  for (let i = 0; i < 8 && initiator.did <= counterparty.did; i++) {
    initiator = await createTestAgent();
    counterparty = await createTestAgent();
  }
  expect(initiator.did > counterparty.did).toBe(true);
  return { initiator, counterparty };
}

describe("mls-welcome", () => {
  test("initiator with lexicographically greater DID may publish welcome", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;

    const { initiator, counterparty } = await pairWithLexicographicInitiator();

    const createRes = await signedFetch(base, {
      method: "POST",
      path: signedPath("/v1/channels"),
      bodyText: "{}",
      privateKey: initiator.privateKey,
      did: initiator.did,
    });
    expect(createRes.ok).toBe(true);
    const created = (await createRes.json()) as { channelId: string; inviteToken: string };

    const joinRes = await signedFetch(base, {
      method: "POST",
      path: signedPath("/v1/channels/join"),
      bodyText: JSON.stringify({ inviteToken: created.inviteToken }),
      privateKey: counterparty.privateKey,
      did: counterparty.did,
    });
    expect(joinRes.ok).toBe(true);

    const sessionId = "sess-lex-gt-initiator";
    const allocatePath = `/v1/channels/${encodeURIComponent(created.channelId)}/sessions/allocate`;
    const allocateRes = await signedFetch(base, {
      method: "POST",
      path: allocatePath,
      bodyText: JSON.stringify({ sessionId, counterpartyDid: counterparty.did }),
      privateKey: initiator.privateKey,
      did: initiator.did,
    });
    expect(allocateRes.ok).toBe(true);

    const welcomePath = `/v1/channels/${encodeURIComponent(created.channelId)}/sessions/${encodeURIComponent(sessionId)}/mls-welcome`;
    const welcomeBody = JSON.stringify({
      welcome: bytesToBase64Url(new Uint8Array([0x01, 0x02, 0x03])),
      route: bytesToBase64Url(new Uint8Array(16).fill(0xab)),
    });
    const publishRes = await signedFetch(base, {
      method: "POST",
      path: welcomePath,
      bodyText: welcomeBody,
      privateKey: initiator.privateKey,
      did: initiator.did,
    });
    expect(publishRes.ok).toBe(true);

    const counterpartyPublish = await signedFetch(base, {
      method: "POST",
      path: welcomePath,
      bodyText: welcomeBody,
      privateKey: counterparty.privateKey,
      did: counterparty.did,
    });
    expect(counterpartyPublish.status).toBe(403);

    server.stop();
    cleanup();
  });

  test("fetch welcome deletes row (delete-on-read)", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;

    const { initiator, counterparty } = await pairWithLexicographicInitiator();

    const createRes = await signedFetch(base, {
      method: "POST",
      path: signedPath("/v1/channels"),
      bodyText: "{}",
      privateKey: initiator.privateKey,
      did: initiator.did,
    });
    const created = (await createRes.json()) as { channelId: string; inviteToken: string };

    await signedFetch(base, {
      method: "POST",
      path: signedPath("/v1/channels/join"),
      bodyText: JSON.stringify({ inviteToken: created.inviteToken }),
      privateKey: counterparty.privateKey,
      did: counterparty.did,
    });

    const sessionId = "sess-delete-on-read";
    const channelPath = `/v1/channels/${encodeURIComponent(created.channelId)}`;
    await signedFetch(base, {
      method: "POST",
      path: `${channelPath}/sessions/allocate`,
      bodyText: JSON.stringify({ sessionId, counterpartyDid: counterparty.did }),
      privateKey: initiator.privateKey,
      did: initiator.did,
    });

    const welcomePath = `${channelPath}/sessions/${encodeURIComponent(sessionId)}/mls-welcome`;
    const route = bytesToBase64Url(new Uint8Array(16).fill(0xcd));
    await signedFetch(base, {
      method: "POST",
      path: welcomePath,
      bodyText: JSON.stringify({
        welcome: bytesToBase64Url(new Uint8Array([0x09])),
        route,
      }),
      privateKey: initiator.privateKey,
      did: initiator.did,
    });

    const fetchRes = await signedFetch(base, {
      method: "GET",
      path: welcomePath,
      bodyText: "",
      privateKey: counterparty.privateKey,
      did: counterparty.did,
    });
    expect(fetchRes.ok).toBe(true);
    const body = (await fetchRes.json()) as { welcome: string; route: string };
    expect(body.route).toBe(route);

    const secondFetch = await signedFetch(base, {
      method: "GET",
      path: welcomePath,
      bodyText: "",
      privateKey: counterparty.privateKey,
      did: counterparty.did,
    });
    expect(secondFetch.status).toBe(404);

    server.stop();
    cleanup();
  });
});
