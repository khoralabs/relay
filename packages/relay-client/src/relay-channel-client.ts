import type {
  RegisterActorResponse,
  RelayChannelCreateBody,
  RelayChannelCreateResponse,
  RelayChannelJoinBody,
  RelayChannelJoinResponse,
  RelayChannelTicketResponse,
  RelayChannelWsNonceResponse,
  RelaySessionAllocateBody,
  RelaySigner,
  RosterSnapshot,
} from "@khoralabs/relay-contracts";
import type { PreKeyBundle, PublishPreKeyBundleBody } from "@khoralabs/relay-crypto";

import {
  allocateSessionHttp,
  createChannelHttp,
  fetchPreKeysHttp,
  getRosterHttp,
  isSessionAllocatedHttp,
  joinChannelHttp,
  mintChannelTicketHttp,
  mintWsNonceHttp,
  publishPreKeysHttp,
  registerActorHttp,
  releaseSessionHttp,
} from "./channels";
import { connectRelay, type RelayConnectOptions, type RelayPeerConnection } from "./connection";

export type RelayClientOptions = {
  relayBaseUrl: string;
  signer: RelaySigner;
};

export class RelayClient {
  constructor(public readonly opts: RelayClientOptions) {}

  createChannel(body: RelayChannelCreateBody = {}): Promise<RelayChannelCreateResponse> {
    return createChannelHttp(this.opts.relayBaseUrl, this.opts.signer, body);
  }

  joinChannel(body: RelayChannelJoinBody): Promise<RelayChannelJoinResponse> {
    return joinChannelHttp(this.opts.relayBaseUrl, this.opts.signer, body);
  }

  mintTicket(channelId: string): Promise<RelayChannelTicketResponse> {
    return mintChannelTicketHttp(this.opts.relayBaseUrl, this.opts.signer, channelId);
  }

  mintWsNonce(channelId: string): Promise<RelayChannelWsNonceResponse> {
    return mintWsNonceHttp(this.opts.relayBaseUrl, this.opts.signer, channelId);
  }

  allocateSession(
    channelId: string,
    body: RelaySessionAllocateBody,
  ): Promise<{ ok: true; sessionId: string }> {
    return allocateSessionHttp(this.opts.relayBaseUrl, this.opts.signer, channelId, body);
  }

  isSessionAllocated(channelId: string, sessionId: string): Promise<boolean> {
    return isSessionAllocatedHttp(this.opts.relayBaseUrl, this.opts.signer, channelId, sessionId);
  }

  releaseSession(channelId: string, sessionId: string): Promise<{ ok: true }> {
    return releaseSessionHttp(this.opts.relayBaseUrl, this.opts.signer, channelId, sessionId);
  }

  registerActor(channelId: string, actorPubkeyHex: string): Promise<RegisterActorResponse> {
    return registerActorHttp(this.opts.relayBaseUrl, this.opts.signer, channelId, actorPubkeyHex);
  }

  getRoster(channelId: string): Promise<RosterSnapshot> {
    return getRosterHttp(this.opts.relayBaseUrl, this.opts.signer, channelId);
  }

  publishPreKeys(body: PublishPreKeyBundleBody): Promise<{ ok: true }> {
    return publishPreKeysHttp(this.opts.relayBaseUrl, this.opts.signer, body);
  }

  fetchPreKeys(did: string): Promise<PreKeyBundle> {
    return fetchPreKeysHttp(this.opts.relayBaseUrl, did);
  }

  connect(opts: RelayConnectOptions): RelayPeerConnection {
    return connectRelay(opts);
  }
}
