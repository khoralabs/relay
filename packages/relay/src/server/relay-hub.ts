import {
  type ChannelAdmissionStore,
  generateChannelSecretHex,
  signChannelTicket,
  verifyChannelTicketClaims,
} from "@khoralabs/relay/admission";
import type { ServerWebSocket } from "bun";
import type { BlobSpool } from "./persistence/sqlite/blob-spool";
import type { ChannelIngressLimiter } from "./relay-ws-limits";
import { MAX_RELAY_WS_FRAME_BYTES } from "./relay-ws-limits";

export type RelayHubWsData = {
  channelId: string;
  ticket: string;
  peerId: string;
  replayAfterId?: number;
};

export type RelayPeer = {
  send(bytes: Uint8Array): void;
};

export type RelayHub = {
  createChannel(
    channelId: string,
    ttlMs?: number,
    createOpts?: { enableSpool?: boolean },
  ): Promise<{ ticket: string }>;
  mintChannelTicket(channelId: string): Promise<{ ticket: string } | undefined>;
  verifyTicket(channelId: string, ticket: string): Promise<boolean>;
  attachPeer(
    channelId: string,
    peer: RelayPeer,
    ticket: string,
    attachOptions?: { replayAfterId?: number },
  ): Promise<void>;
  detachPeer(channelId: string, peer: RelayPeer): void;
  relayBytes(channelId: string, from: RelayPeer, bytes: Uint8Array): void;
  getPeerCount(channelId: string): number;
  isSpoolEnabled(channelId: string): boolean;
  purgeExpiredChannels(nowMs?: number): number;
};

export function createRelayHub(opts: {
  admission: ChannelAdmissionStore;
  spool: BlobSpool;
}): RelayHub {
  const peers = new Map<string, Set<RelayPeer>>();
  const spoolEnabled = new Set<string>();

  const getPeerSet = (channelId: string): Set<RelayPeer> => {
    let set = peers.get(channelId);
    if (set === undefined) {
      set = new Set();
      peers.set(channelId, set);
    }
    return set;
  };

  const issueTicket = async (
    channelId: string,
    secret: string,
    channelExpiresAtMs: number,
  ): Promise<string> => {
    return signChannelTicket(channelId, secret, { expiresAtMs: channelExpiresAtMs });
  };

  const verifyTicketForChannel = async (channelId: string, ticket: string): Promise<boolean> => {
    const now = Date.now();
    const admission = opts.admission.getChannelAdmissionIfActive(channelId, now);
    if (admission === undefined) {
      return false;
    }
    const claims = await verifyChannelTicketClaims(
      channelId,
      ticket,
      admission.pairingSecretHex,
      now,
    );
    return claims !== null;
  };

  return {
    async createChannel(
      channelId: string,
      ttlMs = 86_400_000,
      createOpts?: { enableSpool?: boolean },
    ): Promise<{ ticket: string }> {
      const secret = generateChannelSecretHex();
      const now = Date.now();
      const expiresAtMs = now + ttlMs;
      const ticket = await issueTicket(channelId, secret, expiresAtMs);
      opts.admission.upsertChannelAdmission({
        channelId,
        pairingSecretHex: secret,
        createdAtMs: now,
        expiresAtMs,
      });
      if (createOpts?.enableSpool === true) {
        spoolEnabled.add(channelId);
        opts.spool.purgeChannel(channelId);
      } else {
        spoolEnabled.delete(channelId);
      }
      return { ticket };
    },

    async mintChannelTicket(channelId: string): Promise<{ ticket: string } | undefined> {
      const admission = opts.admission.getChannelAdmissionIfActive(channelId, Date.now());
      if (admission === undefined) {
        return undefined;
      }
      const ticket = await issueTicket(
        channelId,
        admission.pairingSecretHex,
        admission.expiresAtMs,
      );
      return { ticket };
    },

    async verifyTicket(channelId: string, ticket: string): Promise<boolean> {
      return verifyTicketForChannel(channelId, ticket);
    },

    async attachPeer(
      channelId: string,
      peer: RelayPeer,
      ticket: string,
      attachOptions?: { replayAfterId?: number },
    ): Promise<void> {
      const ok = await verifyTicketForChannel(channelId, ticket);
      if (!ok) {
        throw new Error(`RelayHub: invalid or expired ticket for channel: ${channelId}`);
      }
      const set = getPeerSet(channelId);
      set.add(peer);
      if (spoolEnabled.has(channelId)) {
        const afterId = attachOptions?.replayAfterId ?? 0;
        const replay = opts.spool.getBlobsAfter(channelId, afterId);
        for (const row of replay) {
          peer.send(row.blob);
        }
      }
    },

    detachPeer(channelId: string, peer: RelayPeer): void {
      const set = peers.get(channelId);
      if (set === undefined) {
        return;
      }
      set.delete(peer);
      if (set.size === 0) {
        peers.delete(channelId);
        spoolEnabled.delete(channelId);
      }
    },

    relayBytes(channelId: string, _from: RelayPeer, bytes: Uint8Array): void {
      if (bytes.byteLength > MAX_RELAY_WS_FRAME_BYTES) {
        return;
      }
      if (spoolEnabled.has(channelId)) {
        opts.spool.append(channelId, bytes, Date.now());
      }
      const set = peers.get(channelId);
      if (set === undefined) {
        return;
      }
      for (const peer of set) {
        peer.send(bytes);
      }
    },

    getPeerCount(channelId: string): number {
      return peers.get(channelId)?.size ?? 0;
    },

    isSpoolEnabled(channelId: string): boolean {
      return spoolEnabled.has(channelId);
    },

    purgeExpiredChannels(nowMs = Date.now()): number {
      return opts.admission.purgeExpiredChannels(nowMs);
    },
  };
}

export function relayHubWebSocketHandlers(deps: {
  hub: RelayHub;
  ingressLimiter?: ChannelIngressLimiter;
}): {
  open(ws: ServerWebSocket<RelayHubWsData>): void;
  close(ws: ServerWebSocket<RelayHubWsData>): void;
  message(ws: ServerWebSocket<RelayHubWsData>, message: string | Buffer): void;
} {
  const peerByWs = new WeakMap<ServerWebSocket<RelayHubWsData>, RelayPeer>();

  return {
    open(ws) {
      const d = ws.data;
      void (async () => {
        const peer: RelayPeer = {
          send(bytes: Uint8Array) {
            ws.send(bytes);
          },
        };
        peerByWs.set(ws, peer);
        try {
          await deps.hub.attachPeer(d.channelId, peer, d.ticket, {
            replayAfterId: d.replayAfterId,
          });
        } catch {
          ws.close(1008, "invalid ticket");
        }
      })();
    },
    close(ws) {
      const d = ws.data;
      const peer = peerByWs.get(ws);
      if (peer !== undefined) {
        deps.hub.detachPeer(d.channelId, peer);
      }
    },
    message(ws, message) {
      const d = ws.data;
      const peer = peerByWs.get(ws);
      if (peer === undefined) {
        return;
      }
      let bytes: Uint8Array;
      if (typeof message === "string") {
        bytes = new TextEncoder().encode(message);
      } else if (message instanceof ArrayBuffer) {
        bytes = new Uint8Array(message);
      } else {
        bytes = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
      }
      if (bytes.byteLength > MAX_RELAY_WS_FRAME_BYTES) {
        ws.close(1009, "message too large");
        return;
      }
      const ingressLimiter = deps.ingressLimiter;
      if (
        ingressLimiter !== undefined &&
        !ingressLimiter.tryConsume(d.channelId, bytes.byteLength)
      ) {
        ws.close(1008, "ingress budget exceeded");
        return;
      }
      deps.hub.relayBytes(d.channelId, peer, bytes);
    },
  };
}
