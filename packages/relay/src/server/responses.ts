import {
  RELAY_ERROR_CODE,
  type RelayErrorCode,
  relayErrorCodeForStatus,
} from "../contracts/errors";
import { AuthError } from "./auth";

export function jsonError(message: string, status: number, code?: RelayErrorCode): Response {
  return Response.json(
    { error: message, code: code ?? relayErrorCodeForStatus(status) },
    { status },
  );
}

export function rateLimitedResponse(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests", code: RELAY_ERROR_CODE.rate_limited },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function authErrorResponse(e: unknown): Response {
  if (e instanceof AuthError) return jsonError(e.message, e.status);
  return jsonError(e instanceof Error ? e.message : String(e), 401);
}
