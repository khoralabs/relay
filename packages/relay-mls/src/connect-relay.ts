import { relayWsUpgradeProtocol } from "@khoralabs/relay-contracts";

export type RelayPeerConnection = {
  send(blob: Uint8Array): void;
  close(): void;
  readonly closed: boolean;
};

export type RelayConnectOptions = {
  webSocketUrl: string;
  upgradeNonce: string;
  replayAfter?: number;
  onBlob: (blob: Uint8Array) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
};

function webSocketUrlWithReplay(base: string, replayAfter?: number): string {
  if (replayAfter === undefined || !Number.isFinite(replayAfter)) return base;
  const u = new URL(base);
  u.searchParams.set("replayAfter", String(replayAfter));
  return u.toString();
}

export function connectRelay(opts: RelayConnectOptions): RelayPeerConnection {
  const wsUrl = webSocketUrlWithReplay(opts.webSocketUrl, opts.replayAfter);
  const ws = new WebSocket(wsUrl, [relayWsUpgradeProtocol(opts.upgradeNonce)]);
  let closed = false;

  ws.binaryType = "arraybuffer";

  ws.onmessage = (ev) => {
    if (typeof ev.data === "string") {
      opts.onBlob(new TextEncoder().encode(ev.data));
    } else if (ev.data instanceof ArrayBuffer) {
      opts.onBlob(new Uint8Array(ev.data));
    } else if (ev.data instanceof Blob) {
      void ev.data.arrayBuffer().then((buf) => opts.onBlob(new Uint8Array(buf)));
    }
  };

  ws.onclose = () => {
    closed = true;
    opts.onClose?.();
  };

  ws.onerror = () => {
    opts.onError?.(new Error("WebSocket error"));
  };

  return {
    send(blob: Uint8Array): void {
      if (closed || ws.readyState !== WebSocket.OPEN) return;
      ws.send(blob);
    },
    close(): void {
      if (!closed) ws.close();
    },
    get closed(): boolean {
      return closed || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;
    },
  };
}
