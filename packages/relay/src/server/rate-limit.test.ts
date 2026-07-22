import { describe, expect, test } from "bun:test";
import { clientIpFromRequest } from "./rate-limit";

describe("clientIpFromRequest", () => {
  test("ignores forwarding headers without trusted proxy", () => {
    const req = new Request("http://localhost/", {
      headers: {
        "X-Forwarded-For": "1.2.3.4",
        "X-Real-IP": "5.6.7.8",
      },
    });
    expect(clientIpFromRequest(req, { peerAddress: "10.0.0.1" })).toBe("10.0.0.1");
  });

  test("falls back to direct without peer address", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    });
    expect(clientIpFromRequest(req)).toBe("direct");
  });

  test("parses rightmost untrusted XFF hop when trusted", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-Forwarded-For": "spoofed, client, proxy" },
    });
    expect(clientIpFromRequest(req, { trustedProxy: true, peerAddress: "10.0.0.1" })).toBe(
      "client",
    );
  });

  test("single XFF entry when trusted", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-Forwarded-For": "client" },
    });
    expect(clientIpFromRequest(req, { trustedProxy: true, peerAddress: "10.0.0.1" })).toBe(
      "client",
    );
  });

  test("falls back to X-Real-IP when trusted and XFF missing", () => {
    const req = new Request("http://localhost/", {
      headers: { "X-Real-IP": "8.8.8.8" },
    });
    expect(clientIpFromRequest(req, { trustedProxy: true, peerAddress: "10.0.0.1" })).toBe(
      "8.8.8.8",
    );
  });
});
