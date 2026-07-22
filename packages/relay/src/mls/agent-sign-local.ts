import {
  AGENT_REQUEST_HEADER,
  type AgentRequestEnvelope,
  canonicalAgentRequestMessage,
  type RelaySigner,
  randomAgentRequestNonce,
  signatureBytesToB64Url,
} from "@khoralabs/relay/contracts";

export async function signAgentRequest(input: {
  method: string;
  path: string;
  bodyText: string;
  signer: RelaySigner;
  now?: () => number;
  nonce?: () => string;
}): Promise<{ headers: Record<string, string>; envelope: AgentRequestEnvelope }> {
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
