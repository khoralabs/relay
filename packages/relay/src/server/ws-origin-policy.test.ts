import { describe, expect, test } from "bun:test";

import {
  checkWsUpgradeOrigin,
  type WsOriginPolicy,
  wsOriginPolicyFromEnv,
} from "./ws-origin-policy";

describe("wsOriginPolicyFromEnv", () => {
  test("defaults allow missing Origin and reject present Origin when allowlist empty", () => {
    const policy = wsOriginPolicyFromEnv({});
    expect(policy.allowMissingOrigin).toBe(true);
    expect(policy.allowedOrigins.size).toBe(0);
  });

  test("parses comma-separated origins with normalization", () => {
    const policy = wsOriginPolicyFromEnv({
      RELAY_WS_ALLOWED_ORIGINS: "https://app.example.com/, https://other.test/path",
    });
    expect(policy.allowedOrigins.has("https://app.example.com")).toBe(true);
    expect(policy.allowedOrigins.has("https://other.test")).toBe(true);
  });

  test("RELAY_WS_ALLOW_MISSING_ORIGIN=false disables headless path", () => {
    const policy = wsOriginPolicyFromEnv({ RELAY_WS_ALLOW_MISSING_ORIGIN: "false" });
    expect(policy.allowMissingOrigin).toBe(false);
  });
});

describe("checkWsUpgradeOrigin", () => {
  const emptyAllowlist: WsOriginPolicy = { allowedOrigins: new Set(), allowMissingOrigin: true };
  const withAllowlist: WsOriginPolicy = {
    allowedOrigins: new Set(["https://app.example.com"]),
    allowMissingOrigin: true,
  };

  test("allows missing Origin when configured", () => {
    const req = new Request("http://localhost/ws");
    expect(checkWsUpgradeOrigin(req, emptyAllowlist)).toBe(true);
  });

  test("rejects present Origin when allowlist empty", () => {
    const req = new Request("http://localhost/ws", {
      headers: { Origin: "https://evil.com" },
    });
    expect(checkWsUpgradeOrigin(req, emptyAllowlist)).toBe(false);
  });

  test("allows listed Origin", () => {
    const req = new Request("http://localhost/ws", {
      headers: { Origin: "https://app.example.com" },
    });
    expect(checkWsUpgradeOrigin(req, withAllowlist)).toBe(true);
  });

  test("rejects unlisted Origin even when missing Origin allowed", () => {
    const req = new Request("http://localhost/ws", {
      headers: { Origin: "https://evil.com" },
    });
    expect(checkWsUpgradeOrigin(req, withAllowlist)).toBe(false);
  });

  test("rejects missing Origin when allowMissingOrigin false", () => {
    const req = new Request("http://localhost/ws");
    const policy: WsOriginPolicy = { allowedOrigins: new Set(), allowMissingOrigin: false };
    expect(checkWsUpgradeOrigin(req, policy)).toBe(false);
  });
});
