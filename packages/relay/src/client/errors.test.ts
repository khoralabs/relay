import { describe, expect, test } from "bun:test";
import { RELAY_ERROR_CODE } from "@khoralabs/relay/contracts";

import { RelayClientError, throwRelayHttpError } from "./errors";

describe("RelayClientError", () => {
  test("sets status, code, and body", () => {
    const err = new RelayClientError("nope", 404, {
      code: RELAY_ERROR_CODE.not_found,
      body: { error: "nope" },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RelayClientError");
    expect(err.message).toBe("nope");
    expect(err.status).toBe(404);
    expect(err.code).toBe(RELAY_ERROR_CODE.not_found);
    expect(err.body).toEqual({ error: "nope" });
  });
});

describe("throwRelayHttpError", () => {
  test("extracts message and code from envelope", () => {
    expect(() =>
      throwRelayHttpError(404, "Not Found", {
        error: "Channel not found or expired",
        code: RELAY_ERROR_CODE.not_found,
      }),
    ).toThrow(RelayClientError);
    try {
      throwRelayHttpError(404, "Not Found", {
        error: "Channel not found or expired",
        code: RELAY_ERROR_CODE.not_found,
      });
    } catch (e) {
      const err = e as RelayClientError;
      expect(err.message).toBe("Channel not found or expired");
      expect(err.status).toBe(404);
      expect(err.code).toBe(RELAY_ERROR_CODE.not_found);
    }
  });

  test("falls back to error property when envelope parse fails", () => {
    try {
      throwRelayHttpError(400, "Bad Request", { error: "legacy", code: 123 });
    } catch (e) {
      const err = e as RelayClientError;
      expect(err.message).toBe("legacy");
      expect(err.code).toBe(RELAY_ERROR_CODE.invalid_request);
    }
  });

  test("uses statusText and status-derived code for null body", () => {
    try {
      throwRelayHttpError(503, "Service Unavailable", null);
    } catch (e) {
      const err = e as RelayClientError;
      expect(err.message).toBe("Service Unavailable");
      expect(err.code).toBe(RELAY_ERROR_CODE.service_unavailable);
      expect(err.body).toBeNull();
    }
  });
});
