import type {
  RelayChannelCreateBody,
  RelayChannelCreateResponse,
  RelayChannelJoinBody,
  RelayChannelJoinResponse,
  RelayChannelTicketResponse,
  RelayChannelWsNonceResponse,
  RelaySessionAllocateBody,
  RelaySigner,
} from "@khoralabs/relay-contracts";

import {
  allocateSessionHttp,
  createChannelHttp,
  isSessionAllocatedHttp,
  joinChannelHttp,
  mintChannelTicketHttp,
  mintWsNonceHttp,
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

  connect(opts: RelayConnectOptions): RelayPeerConnection {
    return connectRelay(opts);
  }
}
