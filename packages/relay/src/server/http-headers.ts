import { RELAY_WS_UPGRADE_NONCE_HEADER } from "@khoralabs/relay/contracts";

export { AGENT_REQUEST_HEADER } from "@khoralabs/relay/contracts";

/** Relay HTTP / WebSocket upgrade headers. */
export const RELAY_HTTP_HEADER = {
  upgradeNonce: RELAY_WS_UPGRADE_NONCE_HEADER,
  secWebSocketProtocol: "Sec-WebSocket-Protocol",
  contentLength: "Content-Length",
  xRealIp: "X-Real-IP",
  xForwardedFor: "X-Forwarded-For",
} as const;
