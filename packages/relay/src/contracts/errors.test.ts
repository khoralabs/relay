import { describe, expect, test } from "bun:test";
import { parseRelayErrorEnvelope, RELAY_ERROR_CODE, relayErrorCodeForStatus } from "./errors";

describe("relayErrorCodeForStatus", () => {
  test("maps known statuses", () => {
    expect(relayErrorCodeForStatus(401)).toBe(RELAY_ERROR_CODE.unauthorized);
    expect(relayErrorCodeForStatus(403)).toBe(RELAY_ERROR_CODE.forbidden);
    expect(relayErrorCodeForStatus(404)).toBe(RELAY_ERROR_CODE.not_found);
    expect(relayErrorCodeForStatus(409)).toBe(RELAY_ERROR_CODE.conflict);
    expect(relayErrorCodeForStatus(410)).toBe(RELAY_ERROR_CODE.gone);
    expect(relayErrorCodeForStatus(413)).toBe(RELAY_ERROR_CODE.payload_too_large);
    expect(relayErrorCodeForStatus(429)).toBe(RELAY_ERROR_CODE.rate_limited);
    expect(relayErrorCodeForStatus(501)).toBe(RELAY_ERROR_CODE.not_implemented);
    expect(relayErrorCodeForStatus(503)).toBe(RELAY_ERROR_CODE.service_unavailable);
  });

  test("defaults other 4xx to invalid_request", () => {
    expect(relayErrorCodeForStatus(400)).toBe(RELAY_ERROR_CODE.invalid_request);
    expect(relayErrorCodeForStatus(422)).toBe(RELAY_ERROR_CODE.invalid_request);
  });

  test("defaults other 5xx to internal_error", () => {
    expect(relayErrorCodeForStatus(500)).toBe(RELAY_ERROR_CODE.internal_error);
    expect(relayErrorCodeForStatus(502)).toBe(RELAY_ERROR_CODE.internal_error);
  });

  test("falls back for non-error statuses", () => {
    expect(relayErrorCodeForStatus(200)).toBe(RELAY_ERROR_CODE.internal_error);
  });
});

describe("parseRelayErrorEnvelope", () => {
  test("parses error with known code", () => {
    expect(parseRelayErrorEnvelope({ error: "nope", code: "not_found" })).toEqual({
      error: "nope",
      code: RELAY_ERROR_CODE.not_found,
    });
  });

  test("parses error without code", () => {
    expect(parseRelayErrorEnvelope({ error: "nope" })).toEqual({ error: "nope" });
  });

  test("omits unknown codes so the message remains usable", () => {
    expect(parseRelayErrorEnvelope({ error: "nope", code: "future_code" })).toEqual({
      error: "nope",
    });
  });

  test("rejects non-objects and non-string error", () => {
    expect(() => parseRelayErrorEnvelope(null)).toThrow(/expected object/);
    expect(() => parseRelayErrorEnvelope({ error: 1 })).toThrow(/error must be a string/);
  });
});
