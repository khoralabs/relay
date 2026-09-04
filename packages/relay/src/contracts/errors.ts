/** Stable machine-readable codes for relay JSON error envelopes. */

export const RELAY_ERROR_CODE = {
  invalid_request: "invalid_request",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  not_found: "not_found",
  conflict: "conflict",
  gone: "gone",
  rate_limited: "rate_limited",
  payload_too_large: "payload_too_large",
  not_implemented: "not_implemented",
  service_unavailable: "service_unavailable",
  internal_error: "internal_error",
} as const;

export type RelayErrorCode = (typeof RELAY_ERROR_CODE)[keyof typeof RELAY_ERROR_CODE];

const RELAY_ERROR_CODES = new Set<string>(Object.values(RELAY_ERROR_CODE));

export type RelayErrorEnvelope = {
  error: string;
  code?: RelayErrorCode;
};

export function relayErrorCodeForStatus(status: number): RelayErrorCode {
  if (status === 401) return RELAY_ERROR_CODE.unauthorized;
  if (status === 403) return RELAY_ERROR_CODE.forbidden;
  if (status === 404) return RELAY_ERROR_CODE.not_found;
  if (status === 409) return RELAY_ERROR_CODE.conflict;
  if (status === 410) return RELAY_ERROR_CODE.gone;
  if (status === 413) return RELAY_ERROR_CODE.payload_too_large;
  if (status === 429) return RELAY_ERROR_CODE.rate_limited;
  if (status === 501) return RELAY_ERROR_CODE.not_implemented;
  if (status === 503) return RELAY_ERROR_CODE.service_unavailable;
  if (status >= 500) return RELAY_ERROR_CODE.internal_error;
  if (status >= 400) return RELAY_ERROR_CODE.invalid_request;
  return RELAY_ERROR_CODE.internal_error;
}

function isRelayErrorCode(v: unknown): v is RelayErrorCode {
  return typeof v === "string" && RELAY_ERROR_CODES.has(v);
}

/** Hand-written parser for `{ error, code? }` envelopes (no Zod). */
export function parseRelayErrorEnvelope(v: unknown): RelayErrorEnvelope {
  if (typeof v !== "object" || v === null) {
    throw new Error("RelayErrorEnvelope: expected object");
  }
  const o = v as Record<string, unknown>;
  if (typeof o.error !== "string") {
    throw new Error("RelayErrorEnvelope: error must be a string");
  }
  const out: RelayErrorEnvelope = { error: o.error };
  if (isRelayErrorCode(o.code)) {
    out.code = o.code;
  }
  return out;
}
