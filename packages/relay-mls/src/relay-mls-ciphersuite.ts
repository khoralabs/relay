import { RELAY_MLS_CIPHERSUITE_NAME } from "@khoralabs/relay-contracts";
import { type CiphersuiteImpl, getCiphersuiteFromName, nobleCryptoProvider } from "ts-mls";

let cached: CiphersuiteImpl | undefined;

export async function getRelayMlsCiphersuite(): Promise<CiphersuiteImpl> {
  if (cached !== undefined) return cached;
  cached = await nobleCryptoProvider.getCiphersuiteImpl(
    getCiphersuiteFromName(RELAY_MLS_CIPHERSUITE_NAME),
  );
  return cached;
}
