import { MAX_AGENT_REQUEST_BODY_BYTES } from "./auth";

/** Max single WebSocket frame size — aligned with HTTP body cap. */
export const MAX_RELAY_WS_FRAME_BYTES = MAX_AGENT_REQUEST_BODY_BYTES;

const DEFAULT_WS_INGRESS_BYTES_PER_MIN_PER_CHANNEL = 1024 * 1024;
const DEFAULT_WS_INGRESS_FRAMES_PER_MIN_PER_CHANNEL = 1200;

export type ChannelIngressLimiter = {
  tryConsume(channelId: string, byteCount: number): boolean;
};

export function envWsIngressBytesPerMinutePerChannel(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.RELAY_RL_WS_BYTES_PER_MIN_PER_CHANNEL?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_WS_INGRESS_BYTES_PER_MIN_PER_CHANNEL;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_WS_INGRESS_BYTES_PER_MIN_PER_CHANNEL;
  }
  return n;
}

export function envWsIngressFramesPerMinutePerChannel(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.RELAY_RL_WS_FRAMES_PER_MIN_PER_CHANNEL?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_WS_INGRESS_FRAMES_PER_MIN_PER_CHANNEL;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_WS_INGRESS_FRAMES_PER_MIN_PER_CHANNEL;
  }
  return n;
}

export function createChannelIngressLimiter(
  rule: { maxBytesPerWindow: number; maxFramesPerWindow: number; windowMs: number } | null,
): ChannelIngressLimiter {
  if (rule === null) {
    return { tryConsume: () => true };
  }
  const buckets = new Map<string, { windowStart: number; bytes: number; frames: number }>();
  return {
    tryConsume(channelId: string, byteCount: number): boolean {
      const now = Date.now();
      let entry = buckets.get(channelId);
      if (entry === undefined || now - entry.windowStart >= rule.windowMs) {
        entry = { windowStart: now, bytes: 0, frames: 0 };
        buckets.set(channelId, entry);
      }
      if (entry.frames + 1 > rule.maxFramesPerWindow) {
        return false;
      }
      if (entry.bytes + byteCount > rule.maxBytesPerWindow) {
        return false;
      }
      entry.frames += 1;
      entry.bytes += byteCount;
      return true;
    },
  };
}

export function createRelayIngressLimiter(
  env: NodeJS.ProcessEnv = process.env,
): ChannelIngressLimiter {
  return createChannelIngressLimiter({
    maxBytesPerWindow: envWsIngressBytesPerMinutePerChannel(env),
    maxFramesPerWindow: envWsIngressFramesPerMinutePerChannel(env),
    windowMs: 60_000,
  });
}
