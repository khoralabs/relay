import { describe, expect, test } from "bun:test";
import { relayWsUpgradeProtocol } from "@khoralabs/relay/contracts";

import { createTestAgent, createTestRelayApp, signedFetch, signedPath } from "../testing";

const WS_UPGRADE_HEADERS = {
  Upgrade: "websocket",
  Connection: "Upgrade",
  "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
  "Sec-WebSocket-Version": "13",
} as const;

async function createChannelWithNonce(
  base: string,
  agent: Awaited<ReturnType<typeof createTestAgent>>,
) {
  const createRes = await signedFetch(base, {
    method: "POST",
    path: signedPath("/v1/channels"),
    bodyText: "{}",
    privateKey: agent.privateKey,
    did: agent.did,
  });
  expect(createRes.ok).toBe(true);
  return (await createRes.json()) as { webSocketUrl: string; upgradeNonce: string };
}

function wsUpgradeHttpUrl(webSocketUrl: string): string {
  const wsUrl = new URL(webSocketUrl);
  return `http://${wsUrl.host}${wsUrl.pathname}${wsUrl.search}`;
}

function wsUpgradeFetch(
  webSocketUrl: string,
  upgradeNonce: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  return fetch(wsUpgradeHttpUrl(webSocketUrl), {
    headers: {
      ...WS_UPGRADE_HEADERS,
      "Sec-WebSocket-Protocol": relayWsUpgradeProtocol(upgradeNonce),
      ...extraHeaders,
    },
  });
}

describe("ws upgrade origin policy", () => {
  test("rejects spoof Origin when allowlist empty", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const agent = await createTestAgent();
    const { webSocketUrl, upgradeNonce } = await createChannelWithNonce(base, agent);

    const res = await wsUpgradeFetch(webSocketUrl, upgradeNonce, { Origin: "https://evil.com" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("origin");

    server.stop();
    cleanup();
  });

  test("allows upgrade without Origin (headless)", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const agent = await createTestAgent();
    const { webSocketUrl, upgradeNonce } = await createChannelWithNonce(base, agent);

    const ws = new WebSocket(webSocketUrl, [relayWsUpgradeProtocol(upgradeNonce)]);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ws timeout")), 5_000);
      ws.onopen = () => {
        clearTimeout(t);
        ws.close();
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(t);
        reject(new Error("ws error"));
      };
    });

    server.stop();
    cleanup();
  });
});
