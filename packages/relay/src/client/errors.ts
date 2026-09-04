import {
  parseRelayErrorEnvelope,
  type RelayErrorCode,
  relayErrorCodeForStatus,
} from "@khoralabs/relay/contracts";

export class RelayClientError extends Error {
  readonly status: number;
  readonly code?: RelayErrorCode;
  readonly body?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: RelayErrorCode; body?: unknown },
  ) {
    super(message);
    this.name = "RelayClientError";
    this.status = status;
    this.body = options?.body;
    if (options?.code !== undefined) this.code = options.code;
  }
}

/** Throw a {@link RelayClientError} from a failed HTTP JSON response body. */
export function throwRelayHttpError(status: number, statusText: string, body: unknown): never {
  let message = statusText.length > 0 ? statusText : `Request failed with status ${status}`;
  let code: RelayErrorCode | undefined;
  try {
    const env = parseRelayErrorEnvelope(body);
    message = env.error;
    code = env.code;
  } catch {
    if (typeof body === "object" && body !== null && "error" in body) {
      message = String((body as { error: unknown }).error);
    }
  }
  throw new RelayClientError(message, status, {
    code: code ?? relayErrorCodeForStatus(status),
    body,
  });
}
