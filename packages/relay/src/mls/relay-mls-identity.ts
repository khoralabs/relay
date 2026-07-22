import type { Credential } from "ts-mls";

/** MLS basic credential carrying the relay principal DID as identity bytes. */
export function relayDidCredential(did: string): Credential {
  return {
    credentialType: "basic",
    identity: new TextEncoder().encode(did),
  };
}

/** Decode the DID string from a relay basic credential. */
export function didFromRelayCredential(credential: Credential): string | undefined {
  if (credential.credentialType !== "basic") return undefined;
  return new TextDecoder().decode(credential.identity);
}
