import { describe, expect, test } from "bun:test";
import {
  RELAY_HTTP_PATH,
  RELAY_PROTOCOL_VERSION,
  type RelayHealthResponse,
} from "@khoralabs/relay/contracts";

import { createTestRelayApp } from "../testing";

describe("GET /health", () => {
  test("returns JSON ok with protocol version", async () => {
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
      expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
      const body = (await res.json()) as RelayHealthResponse;
      expect(body).toEqual({ ok: true, version: RELAY_PROTOCOL_VERSION });
    } finally {
      server.stop(true);
      cleanup();
    }
  });
});
