import { describe, expect, test } from "bun:test";
import {
  generateChannelSecretHex,
  signChannelTicket,
  verifyChannelTicket,
  verifyChannelTicketClaims,
} from "./channel-ticket";

const futureExp = () => Date.now() + 60_000;

describe("channel-ticket", () => {
  test("round trip", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const ticket = await signChannelTicket(channelId, secret, { expiresAtMs: futureExp() });
    expect(await verifyChannelTicket(channelId, ticket, secret)).toBe(true);
    expect(await verifyChannelTicket("other", ticket, secret)).toBe(false);
  });

  test("rejects prefix channelId mismatch", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const ticket = await signChannelTicket(channelId, secret, { expiresAtMs: futureExp() });
    expect(await verifyChannelTicket("sess-abc", ticket, secret)).toBe(false);
    expect(await verifyChannelTicket("sess-abc-1234", ticket, secret)).toBe(false);
  });

  test("v1 ticket carries nonce and expiry", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const exp = futureExp();
    const ticket = await signChannelTicket(channelId, secret, {
      nonceHex: "aa".repeat(16),
      expiresAtMs: exp,
    });
    const claims = await verifyChannelTicketClaims(channelId, ticket, secret);
    expect(claims?.nonceHex).toBe("aa".repeat(16));
    expect(claims?.expiresAtMs).toBe(exp);
    expect(await verifyChannelTicketClaims(channelId, ticket, secret, exp + 1)).toBeNull();
  });

  test("rejects non-v1 payload", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const legacyPayload = Buffer.from(channelId, "utf8").toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(Buffer.from(secret, "hex")),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(channelId)),
    );
    const ticket = `${legacyPayload}.${Buffer.from(sig).toString("base64url")}`;
    expect(await verifyChannelTicket(channelId, ticket, secret)).toBe(false);
  });
});
