export type RelayAdmissionMode = "invite_only";

export type RelaySessionQuota =
  | { mode: "global"; measure: number }
  | { mode: "principal"; measure: number };

export const DEFAULT_RELAY_SESSION_QUOTA: RelaySessionQuota = { mode: "principal", measure: 8 };

/** HTTP header for one-time WS upgrade nonces. */
export const RELAY_WS_UPGRADE_NONCE_HEADER = "X-Relay-Upgrade-Nonce" as const;

/** Subprotocol prefix for one-time WS upgrade nonces (`Sec-WebSocket-Protocol`). */
export const RELAY_WS_NONCE_PREFIX = "relay.nonce.";

export function relayWsUpgradeProtocol(nonce: string): string {
  return `${RELAY_WS_NONCE_PREFIX}${nonce}`;
}

export type RelayChannelPolicy = {
  admissionMode: RelayAdmissionMode;
  maxPopulation?: number;
  maxSessions: RelaySessionQuota;
};

export type RelayChannelCreateBody = {
  ttlMs?: number;
  maxPopulation?: number;
  maxSessions?: RelaySessionQuota;
  /** Persist blobs to SQLite for late-joiner replay. Off by default. */
  enableSpool?: boolean;
};

export type RelayChannelCreateResponse = {
  channelId: string;
  ticket: string;
  webSocketUrl: string;
  upgradeNonce: string;
  upgradeNonceExpiresAtMs: number;
  expiresAtMs?: number;
  inviteToken?: string;
  policy: RelayChannelPolicy;
};

export type RelayChannelJoinBody = {
  inviteToken: string;
};

export type RelayChannelTicketResponse = {
  channelId: string;
  ticket: string;
  webSocketUrl: string;
  upgradeNonce: string;
  upgradeNonceExpiresAtMs: number;
  expiresAtMs?: number;
  lastBlobId?: number;
  policy?: RelayChannelPolicy;
};

export type RelayChannelWsNonceResponse = {
  channelId: string;
  webSocketUrl: string;
  upgradeNonce: string;
  upgradeNonceExpiresAtMs: number;
};

export type RelayChannelJoinTokenMintResponse = {
  channelId: string;
  joinToken: string;
  expiresAtMs: number;
};

export type RelayChannelJoinResponse = RelayChannelTicketResponse & {
  creatorDid: string;
};

export type RelaySessionAllocateBody = {
  counterpartyDid: string;
  sessionId: string;
};

export type RelaySessionAllocateResponse = {
  ok: true;
  sessionId: string;
};

export type RelaySessionReleaseResponse = {
  ok: true;
};

export type RelaySessionStatusResponse = {
  allocated: true;
  sessionId: string;
};

// ---------------------------------------------------------------------------
// Runtime parse helpers
// ---------------------------------------------------------------------------

function obj(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`${name}: expected object`);
  }
  return v as Record<string, unknown>;
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0)
    throw new Error(`${field}: expected non-empty string`);
  return v;
}

function posInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${field}: expected positive integer`);
  }
  return v;
}

function optPosInt(v: unknown, field: string): number | undefined {
  return v === undefined || v === null ? undefined : posInt(v, field);
}

function optStr(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`${field}: expected string`);
  return v;
}

export function parseRelaySessionQuota(v: unknown): RelaySessionQuota {
  const o = obj(v, "RelaySessionQuota");
  if (o.mode !== "global" && o.mode !== "principal") {
    throw new Error(`RelaySessionQuota.mode: must be "global" or "principal"`);
  }
  return { mode: o.mode, measure: posInt(o.measure, "RelaySessionQuota.measure") };
}

function parseRelayChannelPolicy(v: unknown): RelayChannelPolicy {
  const o = obj(v, "RelayChannelPolicy");
  if (o.admissionMode !== "invite_only") {
    throw new Error(`RelayChannelPolicy.admissionMode: must be "invite_only"`);
  }
  return {
    admissionMode: "invite_only",
    maxPopulation: optPosInt(o.maxPopulation, "RelayChannelPolicy.maxPopulation"),
    maxSessions: parseRelaySessionQuota(o.maxSessions),
  };
}

function parseWsAttachFields(
  o: Record<string, unknown>,
): Pick<RelayChannelTicketResponse, "webSocketUrl" | "upgradeNonce" | "upgradeNonceExpiresAtMs"> {
  return {
    webSocketUrl: str(o.webSocketUrl, "webSocketUrl"),
    upgradeNonce: str(o.upgradeNonce, "upgradeNonce"),
    upgradeNonceExpiresAtMs: posInt(o.upgradeNonceExpiresAtMs, "upgradeNonceExpiresAtMs"),
  };
}

/** Validates the POST /v1/channels request body. */
export function parseRelayChannelCreateBody(v: unknown): RelayChannelCreateBody {
  const o = obj(v, "RelayChannelCreateBody");
  const allowed = new Set(["ttlMs", "maxPopulation", "maxSessions", "enableSpool"]);
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) throw new Error(`RelayChannelCreateBody: unknown key "${k}"`);
  }
  return {
    ttlMs: optPosInt(o.ttlMs, "ttlMs"),
    maxPopulation: optPosInt(o.maxPopulation, "maxPopulation"),
    maxSessions:
      o.maxSessions !== undefined && o.maxSessions !== null
        ? parseRelaySessionQuota(o.maxSessions)
        : undefined,
    enableSpool: o.enableSpool === true ? true : undefined,
  };
}

/** Validates the POST .../sessions/allocate request body. */
export function parseRelaySessionAllocateBody(v: unknown): RelaySessionAllocateBody {
  const o = obj(v, "RelaySessionAllocateBody");
  return {
    counterpartyDid: str(o.counterpartyDid, "counterpartyDid"),
    sessionId: str(o.sessionId, "sessionId"),
  };
}

/** Parses and validates a channel create response from the relay server. */
export function parseRelayChannelCreateResponse(v: unknown): RelayChannelCreateResponse {
  const o = obj(v, "RelayChannelCreateResponse");
  return {
    channelId: str(o.channelId, "channelId"),
    ticket: str(o.ticket, "ticket"),
    ...parseWsAttachFields(o),
    expiresAtMs: optPosInt(o.expiresAtMs, "expiresAtMs"),
    inviteToken: optStr(o.inviteToken, "inviteToken"),
    policy: parseRelayChannelPolicy(o.policy),
  };
}

/** Parses and validates a channel ticket response from the relay server. */
export function parseRelayChannelTicketResponse(v: unknown): RelayChannelTicketResponse {
  const o = obj(v, "RelayChannelTicketResponse");
  const out: RelayChannelTicketResponse = {
    channelId: str(o.channelId, "channelId"),
    ticket: str(o.ticket, "ticket"),
    ...parseWsAttachFields(o),
    expiresAtMs: optPosInt(o.expiresAtMs, "expiresAtMs"),
    policy:
      o.policy !== undefined && o.policy !== null ? parseRelayChannelPolicy(o.policy) : undefined,
  };
  if (typeof o.lastBlobId === "number" && Number.isInteger(o.lastBlobId) && o.lastBlobId >= 0) {
    out.lastBlobId = o.lastBlobId;
  }
  return out;
}

/** Parses and validates a channel join response (extends ticket response). */
export function parseRelayChannelJoinResponse(v: unknown): RelayChannelJoinResponse {
  const base = parseRelayChannelTicketResponse(v);
  const o = obj(v, "RelayChannelJoinResponse");
  return { ...base, creatorDid: str(o.creatorDid, "creatorDid") };
}

/** Parses and validates a WS nonce response from the relay server. */
export function parseRelayChannelWsNonceResponse(v: unknown): RelayChannelWsNonceResponse {
  const o = obj(v, "RelayChannelWsNonceResponse");
  return {
    channelId: str(o.channelId, "channelId"),
    ...parseWsAttachFields(o),
  };
}

/** Parses and validates a session allocate response from the relay server. */
export function parseRelaySessionAllocateResponse(v: unknown): RelaySessionAllocateResponse {
  const o = obj(v, "RelaySessionAllocateResponse");
  if (o.ok !== true) throw new Error("RelaySessionAllocateResponse.ok: expected true");
  return { ok: true, sessionId: str(o.sessionId, "sessionId") };
}

/** Parses and validates a session status response from the relay server. */
export function parseRelaySessionStatusResponse(v: unknown): RelaySessionStatusResponse {
  const o = obj(v, "RelaySessionStatusResponse");
  if (o.allocated !== true) throw new Error("RelaySessionStatusResponse.allocated: expected true");
  return { allocated: true, sessionId: str(o.sessionId, "sessionId") };
}
