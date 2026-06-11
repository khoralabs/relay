import { createHash } from "node:crypto";

import { RELAY_WS_NONCE_PREFIX } from "@khoralabs/relay-contracts";

import { RELAY_HTTP_HEADER } from "./http-headers";

export const DEFAULT_WS_UPGRADE_NONCE_TTL_MS = 60_000;

export function randomWsUpgradeNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function hashWsUpgradeNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

export function wsUpgradeNonceFromProtocolHeader(header: string | null): string | undefined {
  if (header === null || header.length === 0) return undefined;
  for (const part of header.split(",")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(RELAY_WS_NONCE_PREFIX)) {
      const nonce = trimmed.slice(RELAY_WS_NONCE_PREFIX.length);
      if (nonce.length > 0) return nonce;
    }
  }
  return undefined;
}

export function wsUpgradeNonceFromRequest(req: Request): string | undefined {
  const fromHeader = req.headers.get(RELAY_HTTP_HEADER.upgradeNonce)?.trim();
  if (fromHeader !== undefined && fromHeader.length > 0) return fromHeader;
  return wsUpgradeNonceFromProtocolHeader(req.headers.get(RELAY_HTTP_HEADER.secWebSocketProtocol));
}
