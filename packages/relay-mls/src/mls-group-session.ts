import { bytesToBase64Url } from "@khoralabs/relay-crypto";
import {
  acceptAll,
  type ClientState,
  createApplicationMessage,
  createCommit,
  createGroup,
  createProposal,
  decodeGroupState,
  decodeMlsMessage,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  joinGroup,
  type KeyPackage,
  type PrivateKeyPackage,
  processMessage,
} from "ts-mls";

import { decodeKeyPackageWire } from "./key-package-wire";
import type { MlsStatePersistenceAdapter } from "./persistence";
import { createRelayMlsClientConfig, verifyKeyPackageForDid } from "./relay-mls-auth";
import { getRelayMlsCiphersuite } from "./relay-mls-ciphersuite";
import { generateDidBoundKeyPackage } from "./relay-mls-key-package";
import { decodeWelcomeWire, encodeWelcomeWire } from "./welcome-wire";

export type MlsGroupBootstrapResult = {
  welcomeBase64Url: string;
};

export class MlsGroupSession {
  private state: ClientState | undefined;
  private readonly psk = emptyPskIndex;

  private readonly clientConfig = createRelayMlsClientConfig();

  constructor(
    private readonly groupId: string,
    private readonly myDid: string,
    private readonly ed25519PrivateKey: Uint8Array,
    private readonly persistence?: MlsStatePersistenceAdapter,
  ) {}

  get ready(): boolean {
    return this.state !== undefined;
  }

  async load(): Promise<boolean> {
    if (this.persistence === undefined) return false;
    const bytes = await this.persistence.loadGroupState(this.groupId);
    if (bytes === undefined) return false;
    const decoded = decodeGroupState(bytes, 0);
    if (decoded === undefined) return false;
    this.state = { ...decoded[0], clientConfig: this.clientConfig };
    return true;
  }

  private async persist(): Promise<void> {
    if (this.persistence === undefined || this.state === undefined) return;
    await this.persistence.saveGroupState(this.groupId, encodeGroupState(this.state));
  }

  /** Initiator: create group and add peer via KeyPackage bytes. */
  async createWithPeer(
    peerKeyPackageBytes: Uint8Array,
    peerDid: string,
  ): Promise<MlsGroupBootstrapResult> {
    const cs = await getRelayMlsCiphersuite();
    const myKp = await generateDidBoundKeyPackage(this.myDid, this.ed25519PrivateKey, cs);
    const peerKp = decodeKeyPackageWire(peerKeyPackageBytes);
    await verifyKeyPackageForDid(peerKp, peerDid, cs);

    const groupIdBytes = new TextEncoder().encode(this.groupId);
    let state = await createGroup(
      groupIdBytes,
      myKp.publicPackage,
      myKp.privatePackage,
      [],
      cs,
      this.clientConfig,
    );

    const addProposal = { proposalType: "add" as const, add: { keyPackage: peerKp } };
    const { newState: afterProposal } = await createProposal(state, true, addProposal, cs);
    const commitResult = await createCommit(
      { state: afterProposal, cipherSuite: cs, pskIndex: this.psk },
      { ratchetTreeExtension: true },
    );
    state = commitResult.newState;
    if (commitResult.welcome === undefined) {
      throw new Error("MLS createGroup: missing welcome");
    }
    this.state = state;
    await this.persist();
    return { welcomeBase64Url: bytesToBase64Url(encodeWelcomeWire(commitResult.welcome)) };
  }

  /** Responder: join from welcome bytes using local KeyPackage private state. */
  async joinFromWelcome(
    welcomeBytes: Uint8Array,
    privatePackage: PrivateKeyPackage,
    publicPackage: KeyPackage,
  ): Promise<void> {
    const cs = await getRelayMlsCiphersuite();
    const welcome = decodeWelcomeWire(welcomeBytes);
    this.state = await joinGroup(
      welcome,
      publicPackage,
      privatePackage,
      this.psk,
      cs,
      undefined,
      undefined,
      this.clientConfig,
    );
    await this.persist();
  }

  async encryptApplication(plaintext: Uint8Array): Promise<Uint8Array> {
    if (this.state === undefined) throw new Error("MLS group not ready");
    const cs = await getRelayMlsCiphersuite();
    const { newState, privateMessage } = await createApplicationMessage(this.state, plaintext, cs);
    this.state = newState;
    await this.persist();
    return encodeMlsMessage({
      wireformat: "mls_private_message",
      version: "mls10",
      privateMessage,
    });
  }

  /**
   * Process any inbound MLS wire message (application, commit, or proposal).
   * Advances group state for handshake messages; returns application plaintext when present.
   */
  async processInboundMessage(mlsMessageBytes: Uint8Array): Promise<Uint8Array | undefined> {
    if (this.state === undefined) throw new Error("MLS group not ready");
    const cs = await getRelayMlsCiphersuite();
    const decoded = decodeMlsMessage(mlsMessageBytes, 0);
    if (decoded === undefined) {
      throw new Error("failed to decode MLS message bytes");
    }
    const message = decoded[0];
    if (
      message.wireformat !== "mls_private_message" &&
      message.wireformat !== "mls_public_message"
    ) {
      throw new Error(`MLS inbound: unsupported wireformat ${message.wireformat}`);
    }
    const result = await processMessage(message, this.state, this.psk, acceptAll, cs);
    this.state = result.newState;
    await this.persist();
    if (result.kind === "applicationMessage") {
      return result.message;
    }
    return undefined;
  }

  /** Application data only; throws if the wire message is a commit or proposal. */
  async decryptApplication(mlsMessageBytes: Uint8Array): Promise<Uint8Array> {
    const plaintext = await this.processInboundMessage(mlsMessageBytes);
    if (plaintext === undefined) {
      throw new Error("MLS decrypt: expected application message");
    }
    return plaintext;
  }

  /** Empty self-commit for post-compromise security (advance epoch / rotate sender ratchet). */
  async createSelfRekeyMessage(): Promise<Uint8Array> {
    if (this.state === undefined) throw new Error("MLS group not ready");
    const cs = await getRelayMlsCiphersuite();
    const commitResult = await createCommit(
      { state: this.state, cipherSuite: cs, pskIndex: this.psk },
      {},
    );
    this.state = commitResult.newState;
    await this.persist();
    return encodeMlsMessage(commitResult.commit);
  }
}
