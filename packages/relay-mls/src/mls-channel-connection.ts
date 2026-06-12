import type { RelaySigner } from "@khoralabs/relay-contracts";
import { base64UrlToBytes } from "@khoralabs/relay-crypto";
import { connectRelay, type RelayConnectOptions, type RelayPeerConnection } from "./connect-relay";
import type { KeyPackageManager } from "./key-package-manager";
import { fetchKeyPackageHttp } from "./key-packages-http";
import { MlsGroupSession } from "./mls-group-session";
import { fetchMlsWelcomeHttp, publishMlsWelcomeHttp } from "./mls-welcome-http";
import { MultiplexWireSessionRouter } from "./multiplex-wire-session";
import type { MlsStatePersistenceAdapter } from "./persistence";
import { decodeRelayMlsEnvelope, encodeRelayMlsEnvelope } from "./relay-mls-envelope";

const DEFAULT_REKEY_INTERVAL_MS = 30 * 60 * 1000;

export type MlsChannelConnectionOptions = {
  relayBaseUrl: string;
  channelId: string;
  signer: RelaySigner;
  myDid: string;
  /** Raw 32-byte Ed25519 seed for `myDid` (MLS leaf signature key binding). */
  ed25519PrivateKey: Uint8Array;
  keyPackageManager: KeyPackageManager;
  persistence?: MlsStatePersistenceAdapter;
  /** Periodic self-commit interval for PCS; `0` disables. Default 30 minutes. */
  rekeyIntervalMs?: number;
  onGroupMessage?: (groupId: string, payload: Uint8Array) => void;
  onError?: (err: Error) => void;
};

export type MlsChannelConnectOptions = Omit<RelayConnectOptions, "onBlob"> & {
  mls: MlsChannelConnectionOptions;
};

type InboundSlot = { q: Uint8Array[]; w: Array<() => void> };

export class MlsChannelConnection {
  private readonly groups = new Map<string, MlsGroupSession>();
  private readonly wireRouter = new MultiplexWireSessionRouter();
  private readonly inbound: InboundSlot = { q: [], w: [] };
  private readonly rekeyTimers = new Map<string, ReturnType<typeof setInterval>>();
  private peer: RelayPeerConnection | undefined;

  constructor(private readonly opts: MlsChannelConnectionOptions) {}

  static connect(connectOpts: MlsChannelConnectOptions): MlsChannelConnection {
    const conn = new MlsChannelConnection(connectOpts.mls);
    conn.peer = connectRelay({
      ...connectOpts,
      onBlob: (blob) => conn.handleBlob(blob),
    });
    return conn;
  }

  get closed(): boolean {
    return this.peer?.closed ?? true;
  }

  close(): void {
    for (const timer of this.rekeyTimers.values()) {
      clearInterval(timer);
    }
    this.rekeyTimers.clear();
    this.peer?.close();
  }

  /** Initiator: fetch peer KeyPackage, create MLS group, publish welcome. */
  async createGroup(groupId: string, peerDid: string): Promise<void> {
    const fetched = await fetchKeyPackageHttp(this.opts.relayBaseUrl, this.opts.signer, peerDid);
    const session = this.groupSession(groupId);
    const peerBytes = base64UrlToBytes(fetched.keyPackage);
    const { welcomeBase64Url } = await session.createWithPeer(peerBytes, peerDid);
    await publishMlsWelcomeHttp(
      this.opts.relayBaseUrl,
      this.opts.signer,
      this.opts.channelId,
      groupId,
      { welcome: welcomeBase64Url },
    );
    this.scheduleRekey(groupId);
  }

  /** Responder: fetch welcome and join MLS group. */
  async joinGroup(groupId: string): Promise<void> {
    const { welcome } = await fetchMlsWelcomeHttp(
      this.opts.relayBaseUrl,
      this.opts.signer,
      this.opts.channelId,
      groupId,
    );
    const welcomeBytes = base64UrlToBytes(welcome);
    const stored = await this.opts.keyPackageManager.listStoredKeyPackages();
    if (stored.length === 0) {
      throw new Error("no local KeyPackage available for MLS join");
    }
    const session = this.groupSession(groupId);
    let joined = false;
    for (const kp of stored) {
      try {
        await session.joinFromWelcome(welcomeBytes, kp.privatePackage, kp.publicPackage);
        joined = true;
        break;
      } catch {
        // try next published KeyPackage
      }
    }
    if (!joined) {
      throw new Error("MLS joinGroup failed for all local KeyPackages");
    }
    this.scheduleRekey(groupId);
  }

  async send(groupId: string, bytes: Uint8Array): Promise<void> {
    const session = this.groupSession(groupId);
    if (!session.ready) {
      const loaded = await session.load();
      if (!loaded) throw new Error(`MLS group ${groupId} not ready`);
    }
    const mlsPayload = await session.encryptApplication(bytes);
    const envelope = encodeRelayMlsEnvelope(groupId, mlsPayload);
    this.peer?.send(envelope);
  }

  /** Send multiplex wire bytes wrapped in MLS for the inferred session. */
  async sendMultiplexWire(wireBytes: Uint8Array): Promise<void> {
    const sessionId = this.wireRouter.extractSessionId(wireBytes);
    if (sessionId === undefined) {
      throw new Error("cannot infer session_id from multiplex wire bytes");
    }
    await this.send(sessionId, wireBytes);
  }

  /** OBP-compatible duplex: MLS encrypts outbound multiplex wire; decrypts inbound to cleartext multiplex. */
  createObpDuplex(): {
    read(): AsyncIterable<Uint8Array>;
    write(bytes: Uint8Array): Promise<void>;
    close(reason?: unknown): Promise<void>;
  } {
    const inbound = this.inbound;
    const conn = this;
    return {
      async *read() {
        for (;;) {
          const next = inbound.q.shift();
          if (next !== undefined) {
            yield next;
            continue;
          }
          if (conn.closed) return;
          await new Promise<void>((resolve) => inbound.w.push(resolve));
        }
      },
      write: (bytes) => conn.sendMultiplexWire(bytes),
      close: async () => conn.close(),
    };
  }

  private pushInbound(bytes: Uint8Array): void {
    this.inbound.q.push(bytes);
    for (const w of this.inbound.w) w();
    this.inbound.w.length = 0;
  }

  private groupSession(groupId: string): MlsGroupSession {
    let session = this.groups.get(groupId);
    if (session === undefined) {
      session = new MlsGroupSession(
        groupId,
        this.opts.myDid,
        this.opts.ed25519PrivateKey,
        this.opts.persistence,
      );
      this.groups.set(groupId, session);
    }
    return session;
  }

  private handleBlob(blob: Uint8Array): void {
    const envelope = decodeRelayMlsEnvelope(blob);
    if (envelope === undefined) return;

    void this.handleMlsEnvelope(envelope).catch((e) => {
      const err = e instanceof Error ? e : new Error(String(e));
      this.opts.onError?.(err);
    });
  }

  private async handleMlsEnvelope(
    envelope: ReturnType<typeof decodeRelayMlsEnvelope> & object,
  ): Promise<void> {
    const session = this.groupSession(envelope.groupId);
    if (!session.ready) {
      const loaded = await session.load();
      if (!loaded) return;
    }
    this.scheduleRekey(envelope.groupId);
    const plaintext = await session.processInboundMessage(envelope.payload);
    if (plaintext === undefined) {
      return;
    }
    this.wireRouter.extractSessionId(plaintext);
    this.pushInbound(plaintext);
    this.opts.onGroupMessage?.(envelope.groupId, plaintext);
  }

  private rekeyIntervalMs(): number {
    const configured = this.opts.rekeyIntervalMs ?? DEFAULT_REKEY_INTERVAL_MS;
    return configured;
  }

  private scheduleRekey(groupId: string): void {
    const intervalMs = this.rekeyIntervalMs();
    if (intervalMs <= 0) return;
    if (this.rekeyTimers.has(groupId)) return;
    const timer = setInterval(() => {
      void this.sendRekey(groupId).catch((e) => {
        const err = e instanceof Error ? e : new Error(String(e));
        this.opts.onError?.(err);
      });
    }, intervalMs);
    this.rekeyTimers.set(groupId, timer);
  }

  private async sendRekey(groupId: string): Promise<void> {
    if (this.closed) return;
    const session = this.groupSession(groupId);
    if (!session.ready) {
      const loaded = await session.load();
      if (!loaded) return;
    }
    const mlsPayload = await session.createSelfRekeyMessage();
    this.peer?.send(encodeRelayMlsEnvelope(groupId, mlsPayload));
  }
}
