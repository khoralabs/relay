import {
  conservativeEffectiveNow,
  createHlcState,
  type HlcState,
  type RelayHlcTimestamp,
  recvHlc,
  sendHlc,
} from "./relay-hlc";
import {
  decodeRelayTimingFrame,
  encodeRelayTimingBody,
  encodeRelayTimingFrame,
  type RelayClockObservation,
  type RelayTimingFrame,
} from "./relay-timing";

const MAX_SAMPLES_PER_ACTOR = 64;

export type RelayTimingContext = {
  effectiveNowMs(): number | null;
  getCurrentHlc(): RelayHlcTimestamp;
  addObservations(obs: RelayClockObservation[]): void;
};

export function withTiming(opts: {
  innerSend(frame: Uint8Array): void;
  onBody(body: Uint8Array, timing: RelayTimingFrame): void;
  nodeId: string;
}): {
  send(body: Uint8Array): void;
  handleFrame(raw: Uint8Array): void;
  timingContext: RelayTimingContext;
} {
  void opts.nodeId;
  const hlcState: HlcState = createHlcState();
  const samplesByActor = new Map<string, Array<{ peer_pt: number; recv_ms: number }>>();

  function pushSample(actor: string, peer_pt: number, recv_ms: number): void {
    const buf = samplesByActor.get(actor) ?? [];
    buf.push({ peer_pt, recv_ms });
    if (buf.length > MAX_SAMPLES_PER_ACTOR) buf.shift();
    samplesByActor.set(actor, buf);
  }

  function allSamples(): Array<{ peer_pt: number; recv_ms: number }> {
    const out: Array<{ peer_pt: number; recv_ms: number }> = [];
    for (const buf of samplesByActor.values()) out.push(...buf);
    return out;
  }

  const timingContext: RelayTimingContext = {
    effectiveNowMs(): number | null {
      return conservativeEffectiveNow(hlcState, Date.now(), allSamples());
    },
    getCurrentHlc(): RelayHlcTimestamp {
      return { pt: hlcState.pt, lc: hlcState.lc };
    },
    addObservations(obs: RelayClockObservation[]): void {
      for (const o of obs) {
        pushSample(o.peer_actor, o.peer_pt, o.recv_ms);
      }
    },
  };

  return {
    send(body: Uint8Array): void {
      const hlc = sendHlc(hlcState, Date.now());
      const frame = encodeRelayTimingFrame({
        hlc,
        body: encodeRelayTimingBody(body),
      });
      opts.innerSend(frame);
    },
    handleFrame(raw: Uint8Array): void {
      const decoded = decodeRelayTimingFrame(raw);
      if (decoded === undefined) return;
      recvHlc(hlcState, decoded.hlc, Date.now());
      if (decoded.observed !== undefined) {
        pushSample(decoded.observed.peer_actor, decoded.observed.peer_pt, decoded.observed.recv_ms);
      }
      const wireFrame: RelayTimingFrame = {
        v: "rt1",
        hlc: decoded.hlc,
        body: encodeRelayTimingBody(decoded.body),
        ...(decoded.observed !== undefined ? { observed: decoded.observed } : {}),
      };
      opts.onBody(decoded.body, wireFrame);
    },
    timingContext,
  };
}
