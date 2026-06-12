import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { bytesToBase64Url } from "@khoralabs/relay-crypto";

import { decryptMlsGroupState, encryptMlsGroupState } from "./mls-group-state-cipher";
import { mlsGroupStateKeyFromEnv } from "./mls-group-state-key";

/**
 * Persistence for MLS group state bytes.
 *
 * **Security:** `encodeGroupState` material includes ratchet tree and epoch secrets. Any
 * disk- or DB-backed adapter must store **encrypted** bytes only — use
 * {@link createEncryptingMlsStatePersistence} or {@link createFileMlsStatePersistence}.
 * {@link MemoryMlsStatePersistence} is for tests and ephemeral in-process use only.
 */
export type MlsStatePersistenceAdapter = {
  loadGroupState(groupId: string): Promise<Uint8Array | undefined>;
  saveGroupState(groupId: string, stateBytes: Uint8Array): Promise<void>;
  deleteGroupState(groupId: string): Promise<void>;
  loadRouteHandle?(groupId: string): Promise<string | undefined>;
  saveRouteHandle?(groupId: string, route: string): Promise<void>;
  deleteRouteHandle?(groupId: string): Promise<void>;
};

/** In-process only; does not encrypt (secrets live in heap). */
export class MemoryMlsStatePersistence implements MlsStatePersistenceAdapter {
  private readonly store = new Map<string, Uint8Array>();
  private readonly routes = new Map<string, string>();

  loadGroupState(groupId: string): Promise<Uint8Array | undefined> {
    return Promise.resolve(this.store.get(groupId));
  }

  saveGroupState(groupId: string, stateBytes: Uint8Array): Promise<void> {
    this.store.set(groupId, stateBytes);
    return Promise.resolve();
  }

  deleteGroupState(groupId: string): Promise<void> {
    this.store.delete(groupId);
    this.routes.delete(groupId);
    return Promise.resolve();
  }

  loadRouteHandle(groupId: string): Promise<string | undefined> {
    return Promise.resolve(this.routes.get(groupId));
  }

  saveRouteHandle(groupId: string, route: string): Promise<void> {
    this.routes.set(groupId, route);
    return Promise.resolve();
  }

  deleteRouteHandle(groupId: string): Promise<void> {
    this.routes.delete(groupId);
    return Promise.resolve();
  }
}

/** AES-256-GCM envelope around an inner store (mirrors relay pairing-secret at-rest encryption). */
export function createEncryptingMlsStatePersistence(
  inner: MlsStatePersistenceAdapter,
  encryptionKey: Uint8Array,
): MlsStatePersistenceAdapter {
  return {
    async loadGroupState(groupId: string): Promise<Uint8Array | undefined> {
      const stored = await inner.loadGroupState(groupId);
      if (stored === undefined) return undefined;
      return decryptMlsGroupState(stored, groupId, encryptionKey);
    },
    async saveGroupState(groupId: string, stateBytes: Uint8Array): Promise<void> {
      const encrypted = encryptMlsGroupState(stateBytes, groupId, encryptionKey);
      await inner.saveGroupState(groupId, encrypted);
    },
    deleteGroupState: (groupId) => inner.deleteGroupState(groupId),
  };
}

function filePathForGroup(dir: string, groupId: string): string {
  const safe = bytesToBase64Url(new TextEncoder().encode(groupId));
  return join(dir, `${safe}.mls-state`);
}

class RawFileMlsStatePersistence implements MlsStatePersistenceAdapter {
  constructor(private readonly dir: string) {}

  async loadGroupState(groupId: string): Promise<Uint8Array | undefined> {
    const file = Bun.file(filePathForGroup(this.dir, groupId));
    if (!(await file.exists())) return undefined;
    return new Uint8Array(await file.arrayBuffer());
  }

  async saveGroupState(groupId: string, stateBytes: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await Bun.write(filePathForGroup(this.dir, groupId), stateBytes);
  }

  async deleteGroupState(groupId: string): Promise<void> {
    const path = filePathForGroup(this.dir, groupId);
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}

/** Disk-backed MLS state with AES-256-GCM encryption (key from env or explicit). */
export function createFileMlsStatePersistence(
  dir: string,
  encryptionKey?: Uint8Array,
): MlsStatePersistenceAdapter {
  const key = encryptionKey ?? mlsGroupStateKeyFromEnv();
  return createEncryptingMlsStatePersistence(new RawFileMlsStatePersistence(dir), key);
}
