export { AGENT_REQUEST_HEADER } from "@khoralabs/relay-contracts";

/** Relay HTTP / WebSocket upgrade headers. */
export const RELAY_HTTP_HEADER = {
  upgradeNonce: "X-Relay-Upgrade-Nonce",
  secWebSocketProtocol: "Sec-WebSocket-Protocol",
  contentLength: "Content-Length",
  xRealIp: "X-Real-IP",
  xForwardedFor: "X-Forwarded-For",
} as const;
