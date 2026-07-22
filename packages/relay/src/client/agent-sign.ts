import {
  AGENT_REQUEST_HEADER,
  type AgentRequestEnvelope,
  canonicalAgentRequestMessage,
  canonicalAgentRequestPath,
  type RelaySigner,
  randomAgentRequestNonce,
  signatureBytesToB64Url,
} from "@khoralabs/relay/contracts";

export type SignAgentRequestInput = {
  method: string;
  path: string;
  bodyText: string;
  signer: RelaySigner;
  /** Override the clock (defaults to `Date.now`). */
  now?: () => number;
  /** Override the nonce generator (defaults to `randomAgentRequestNonce`). */
  nonce?: () => string;
};

export type SignedAgentRequest = {
  /** Headers ready to merge into a fetch request. */
  headers: Record<string, string>;
  envelope: AgentRequestEnvelope;
};

/**
 * Build the four `X-Agent-*` headers (plus the parsed envelope) for the given
 * METHOD + PATH + body using the signer's DID.
 */
export async function signAgentRequest(input: SignAgentRequestInput): Promise<SignedAgentRequest> {
  const timestampMs = (input.now ?? Date.now)();
  const nonce = (input.nonce ?? randomAgentRequestNonce)();
  const message = await canonicalAgentRequestMessage({
    method: input.method,
    path: input.path,
    timestampMs,
    nonce,
    bodyText: input.bodyText,
  });
  const sigBytes = await input.signer.sign(message);
  const signatureB64Url = signatureBytesToB64Url(sigBytes);
  const headers: Record<string, string> = {
    [AGENT_REQUEST_HEADER.did]: input.signer.did,
    [AGENT_REQUEST_HEADER.ts]: String(timestampMs),
    [AGENT_REQUEST_HEADER.nonce]: nonce,
    [AGENT_REQUEST_HEADER.sig]: signatureB64Url,
  };
  return {
    headers,
    envelope: { did: input.signer.did, timestampMs, nonce, signatureB64Url },
  };
}

export async function signedAgentFetch(
  baseUrl: string,
  input: {
    method: string;
    path: string;
    bodyText?: string;
    signer: RelaySigner;
    signedQueryKeys?: string[];
  },
): Promise<Response> {
  const bodyText = input.bodyText ?? "";
  const path =
    input.signedQueryKeys !== undefined && input.signedQueryKeys.length > 0
      ? canonicalAgentRequestPath(
          input.path.split("?")[0] ?? input.path,
          new URL(input.path, "http://local").searchParams,
          input.signedQueryKeys,
        )
      : input.path;
  const { headers } = await signAgentRequest({
    method: input.method,
    path,
    bodyText,
    signer: input.signer,
  });
  const url = new URL(input.path, baseUrl.replace(/\/$/, ""));
  return fetch(url, {
    method: input.method,
    headers: {
      ...headers,
      ...(bodyText.length > 0 ? { "content-type": "application/json" } : {}),
    },
    body: bodyText.length > 0 ? bodyText : undefined,
  });
}
