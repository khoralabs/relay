function bytesToHexLower(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function uint8ArrayToDetachedArrayBuffer(u: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u.byteLength);
  copy.set(u);
  return copy.buffer;
}

export function generateChannelSecretHex(byteLength = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToHexLower(raw);
}

function toB64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64Url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

async function importHmacKey(secretHex: string): Promise<CryptoKey> {
  const keyMaterial = Uint8Array.from(Buffer.from(secretHex, "hex"));
  return crypto.subtle.importKey(
    "raw",
    uint8ArrayToDetachedArrayBuffer(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const TICKET_V1_PREFIX = "v1:";

export type ChannelTicketClaims = {
  expiresAtMs: number;
  nonceHex?: string;
};

export type VerifiedChannelTicket = {
  channelId: string;
  expiresAtMs: number;
  nonceHex?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function encodeTicketPayload(channelId: string, claims: ChannelTicketClaims): Uint8Array {
  const body: Record<string, string | number> = {
    cid: channelId,
    exp: claims.expiresAtMs,
  };
  if (claims.nonceHex !== undefined) {
    body.n = claims.nonceHex;
  }
  return new TextEncoder().encode(TICKET_V1_PREFIX + JSON.stringify(body));
}

function parseTicketPayload(
  payloadBytes: Uint8Array,
  channelId: string,
): VerifiedChannelTicket | null {
  const text = new TextDecoder().decode(payloadBytes);
  if (!text.startsWith(TICKET_V1_PREFIX)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(TICKET_V1_PREFIX.length)) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.cid !== channelId) {
    return null;
  }
  if (typeof parsed.exp !== "number") {
    return null;
  }
  const nonceHex = typeof parsed.n === "string" ? parsed.n : undefined;
  return { channelId, expiresAtMs: parsed.exp, nonceHex };
}

async function verifyTicketPayload(
  channelId: string,
  ticket: string,
  secretHex: string,
): Promise<VerifiedChannelTicket | null> {
  const dot = ticket.indexOf(".");
  if (dot < 1) return null;
  const payloadB64 = ticket.slice(0, dot);
  const sigB64 = ticket.slice(dot + 1);
  if (payloadB64 === "" || sigB64 === "") return null;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = fromB64Url(payloadB64);
    sigBytes = fromB64Url(sigB64);
  } catch {
    return null;
  }
  const claims = parseTicketPayload(payloadBytes, channelId);
  if (claims === null) return null;
  const key = await importHmacKey(secretHex);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    uint8ArrayToDetachedArrayBuffer(sigBytes),
    uint8ArrayToDetachedArrayBuffer(payloadBytes),
  );
  if (!ok) return null;
  return claims;
}

export async function signChannelTicket(
  channelId: string,
  secretHex: string,
  claims: ChannelTicketClaims,
): Promise<string> {
  const payloadBytes = encodeTicketPayload(channelId, claims);
  const key = await importHmacKey(secretHex);
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    uint8ArrayToDetachedArrayBuffer(payloadBytes),
  );
  return `${toB64Url(payloadBytes)}.${toB64Url(new Uint8Array(sigBuf))}`;
}

export async function verifyChannelTicketClaims(
  channelId: string,
  ticket: string,
  secretHex: string,
  nowMs = Date.now(),
): Promise<VerifiedChannelTicket | null> {
  const claims = await verifyTicketPayload(channelId, ticket, secretHex);
  if (claims === null || claims.expiresAtMs <= nowMs) {
    return null;
  }
  return claims;
}

export async function verifyChannelTicket(
  channelId: string,
  ticket: string,
  secretHex: string,
): Promise<boolean> {
  return (await verifyChannelTicketClaims(channelId, ticket, secretHex)) !== null;
}
