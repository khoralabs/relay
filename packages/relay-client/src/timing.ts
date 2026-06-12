import {
  type RelayTimingContext,
  type RelayTimingFrame,
  withTiming,
} from "@khoralabs/relay-contracts";

import { connectRelay, type RelayConnectOptions, type RelayPeerConnection } from "./connection";

export type TimedRelayChannel = {
  send(body: Uint8Array): void;
  close(): void;
  readonly closed: boolean;
  timingContext: RelayTimingContext;
};

export type TimedRelayConnectOptions = Omit<RelayConnectOptions, "onBlob"> & {
  nodeId: string;
  onBody: (body: Uint8Array, timing: RelayTimingFrame) => void;
};

export function connectTimedRelay(opts: TimedRelayConnectOptions): TimedRelayChannel {
  let timingLayer: ReturnType<typeof withTiming> | undefined;
  const inner = connectRelay({
    webSocketUrl: opts.webSocketUrl,
    upgradeNonce: opts.upgradeNonce,
    replayAfter: opts.replayAfter,
    onClose: opts.onClose,
    onError: opts.onError,
    onBlob: (blob) => {
      timingLayer?.handleFrame(blob);
    },
  });
  timingLayer = withTiming({
    nodeId: opts.nodeId,
    innerSend: (frame) => inner.send(frame),
    onBody: opts.onBody,
  });
  return {
    send: (body) => timingLayer?.send(body),
    close: () => inner.close(),
    get closed(): boolean {
      return inner.closed;
    },
    timingContext: timingLayer.timingContext,
  };
}

export function wrapTimedRelayPeer(
  peer: RelayPeerConnection,
  opts: { nodeId: string; onBody: (body: Uint8Array, timing: RelayTimingFrame) => void },
): TimedRelayChannel {
  const timingLayer = withTiming({
    nodeId: opts.nodeId,
    innerSend: (frame) => peer.send(frame),
    onBody: opts.onBody,
  });
  return {
    send: (body) => timingLayer.send(body),
    close: () => peer.close(),
    get closed(): boolean {
      return peer.closed;
    },
    timingContext: timingLayer.timingContext,
  };
}
