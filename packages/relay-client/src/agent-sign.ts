import {
  AGENT_REQUEST_HEADER,
  canonicalAgentRequestMessage,
  canonicalAgentRequestPath,
  type RelaySigner,
  randomAgentRequestNonce,
  signatureBytesToB64Url,
} from "@khoralabs/relay-contracts";

export async function signAgentRequest(input: {
  method: string;
  path: string;
  bodyText: string;
  signer: RelaySigner;
}): Promise<Record<string, string>> {
  const timestampMs = Date.now();
  const nonce = randomAgentRequestNonce();
  const message = await canonicalAgentRequestMessage({
    method: input.method,
    path: input.path,
    timestampMs,
    nonce,
    bodyText: input.bodyText,
  });
  const sigBytes = await input.signer.sign(message);
  return {
    [AGENT_REQUEST_HEADER.did]: input.signer.did,
    [AGENT_REQUEST_HEADER.ts]: String(timestampMs),
    [AGENT_REQUEST_HEADER.nonce]: nonce,
    [AGENT_REQUEST_HEADER.sig]: signatureBytesToB64Url(sigBytes),
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
  const headers = await signAgentRequest({
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
