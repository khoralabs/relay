import type { MlsStatePersistenceAdapter } from "./persistence";

/** Persistence key for the encrypted KeyPackage private-state blob (not an MLS group id). */
export const KEY_PACKAGE_STORE_PERSISTENCE_ID = "__mls_key_packages__";

export type KeyPackageStoreEntry = {
  publicB64: string;
  initPrivateKeyB64: string;
  hpkePrivateKeyB64: string;
  signaturePrivateKeyB64: string;
};

export type KeyPackageStore = {
  entries: KeyPackageStoreEntry[];
  /** Public b64 of the local last-resort package (re-appended to relay when pool drains). */
  lastResortPublicB64?: string;
};

export async function loadKeyPackageStore(
  persistence: MlsStatePersistenceAdapter,
): Promise<KeyPackageStore> {
  const bytes = await persistence.loadGroupState(KEY_PACKAGE_STORE_PERSISTENCE_ID);
  if (bytes === undefined) {
    return { entries: [] };
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as KeyPackageStore;
  if (!Array.isArray(parsed.entries)) {
    return { entries: [] };
  }
  return {
    entries: parsed.entries,
    lastResortPublicB64: parsed.lastResortPublicB64,
  };
}

export async function saveKeyPackageStore(
  persistence: MlsStatePersistenceAdapter,
  store: KeyPackageStore,
): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(store));
  await persistence.saveGroupState(KEY_PACKAGE_STORE_PERSISTENCE_ID, bytes);
}
