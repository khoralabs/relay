import { jsonError } from "../responses";
import type { RelayHttpDeps } from "./deps";

export function resolveChannelId(deps: RelayHttpDeps, channelIdRaw: string): string | Response {
  const channelId = decodeURIComponent(channelIdRaw);
  if (deps.relayProfile.mode === "single" && channelId !== deps.relayProfile.config.channelId) {
    return jsonError("channel id does not match this relay instance", 404);
  }
  return channelId;
}
