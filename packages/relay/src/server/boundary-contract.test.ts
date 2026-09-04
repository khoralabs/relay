import { describe, expect, test } from "bun:test";
import { RelayClientError } from "@khoralabs/relay/client";
import {
  DEFAULT_RELAY_SESSION_QUOTA,
  RELAY_ERROR_CODE,
  RELAY_HTTP_PATH,
  RELAY_PROTOCOL_VERSION,
  type RelayHealthResponse,
  relayChannelActorPath,
  relayChannelAllocatePath,
  relayChannelJoinTokensPath,
  relayChannelMlsWelcomePath,
  relayChannelReleasePath,
  relayChannelRosterPath,
  relayChannelSessionPath,
  relayChannelTicketPath,
  relayChannelWsNoncePath,
  relayChannelWsPath,
  relayKeyPackageDidPath,
} from "@khoralabs/relay/contracts";
import { signAsync } from "@noble/ed25519";
import { createChannelHttp } from "../client/channels";
import { createTestAgent, createTestRelayApp } from "../testing";
import {
  channelActorPathRe,
  channelAllocatePathRe,
  channelJoinTokensPathRe,
  channelMlsWelcomePathRe,
  channelReleasePathRe,
  channelRosterPathRe,
  channelSessionStatusPathRe,
  channelTicketPathRe,
  channelWsNoncePathRe,
  channelWsPathRe,
  keyPackageDidPathRe,
  keyPackagesPathRe,
} from "./http/paths";

describe("client↔router boundary contracts", () => {
  test("path builders match server regexes", () => {
    const channelId = "ch_test";
    const sessionId = "sess_test";
    const did = "did:key:zTest";

    expect(channelWsPathRe.test(relayChannelWsPath(channelId))).toBe(true);
    expect(channelTicketPathRe.test(relayChannelTicketPath(channelId))).toBe(true);
    expect(channelJoinTokensPathRe.test(relayChannelJoinTokensPath(channelId))).toBe(true);
    expect(channelWsNoncePathRe.test(relayChannelWsNoncePath(channelId))).toBe(true);
    expect(channelAllocatePathRe.test(relayChannelAllocatePath(channelId))).toBe(true);
    expect(channelSessionStatusPathRe.test(relayChannelSessionPath(channelId, sessionId))).toBe(
      true,
    );
    expect(channelReleasePathRe.test(relayChannelReleasePath(channelId, sessionId))).toBe(true);
    expect(channelActorPathRe.test(relayChannelActorPath(channelId))).toBe(true);
    expect(channelRosterPathRe.test(relayChannelRosterPath(channelId))).toBe(true);
    expect(channelMlsWelcomePathRe.test(relayChannelMlsWelcomePath(channelId, sessionId))).toBe(
      true,
    );
    expect(keyPackagesPathRe.test(RELAY_HTTP_PATH.keyPackages)).toBe(true);
    expect(keyPackageDidPathRe.test(relayKeyPackageDidPath(did))).toBe(true);
  });

  test("GET /health returns shared protocol version", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const res = await fetch(`${base}${RELAY_HTTP_PATH.health}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as RelayHealthResponse;
      expect(body).toEqual({ ok: true, version: RELAY_PROTOCOL_VERSION });
    } finally {
      server.stop(true);
      cleanup();
    }
  });

  test("unknown route returns not_found code", async () => {
    const { app, cleanup } = await createTestRelayApp();
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const res = await fetch(`${base}/v1/no-such-route`);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string; code: string };
      expect(body.code).toBe(RELAY_ERROR_CODE.not_found);
    } finally {
      server.stop(true);
      cleanup();
    }
  });

  test("client surfaces RelayClientError code for single-mode create", async () => {
    const { app, cleanup } = await createTestRelayApp({
      singleBootstrap: {
        channelId: "ch_boundary_single",
        creatorDid: "did:key:zBoundaryCreator",
        ttlMs: 60_000,
        maxPopulation: null,
        maxSessions: DEFAULT_RELAY_SESSION_QUOTA,
      },
    });
    const server = Bun.serve({
      port: 0,
      fetch(req, srv) {
        return app.fetch(req, srv);
      },
      websocket: app.websocket,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const agent = await createTestAgent();
    const signer = {
      did: agent.did,
      sign: (m: Uint8Array) => signAsync(m, agent.privateKey),
    };
    try {
      await createChannelHttp(base, signer);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RelayClientError);
      const err = e as RelayClientError;
      expect(err.status).toBe(501);
      expect(err.code).toBe(RELAY_ERROR_CODE.not_implemented);
    } finally {
      server.stop(true);
      cleanup();
    }
  });
});
