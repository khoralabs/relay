import { canonicalAgentRequestPath, type RelaySigner } from "@khoralabs/relay-contracts";

import { signAgentRequest } from "./agent-sign-local";

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
