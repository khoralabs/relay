import { wsUpgradeNonceFromRequest } from "@khoralabs/relay-admission";
import { relayWsUpgradeProtocol } from "@khoralabs/relay-contracts";

import type { RelayHubWsData } from "../relay-hub";
import { jsonError } from "../responses";
import { resolveChannelId } from "./channel-id";
import type { RelayHttpDeps } from "./deps";
import { checkDefaultIpRateLimit } from "./request";

export async function handleChannelWsUpgrade(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
  server: Bun.Server<RelayHubWsData>,
): Promise<Response | undefined> {
  const ipCheck = checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const t = deps.now();
  const channel = deps.registry.getChannel(channelId, t);
  if (channel === undefined) return jsonError("Channel not found or expired", 404);

  const upgradeNonce = wsUpgradeNonceFromRequest(req);
  let admitted = false;
  let selectedProtocol: string | undefined;

  if (upgradeNonce !== undefined) {
    admitted = deps.registry.consumeWsUpgradeNonce(channelId, upgradeNonce, t);
    if (admitted) {
      selectedProtocol = relayWsUpgradeProtocol(upgradeNonce);
    }
  }

  if (!admitted) {
    return jsonError("Invalid or expired upgrade credentials", 401);
  }

  const minted = await deps.hub.mintChannelTicket(channelId);
  if (minted === undefined) {
    return jsonError("Channel not found or expired", 404);
  }

  const peerId = crypto.randomUUID();
  const replayAfterRaw = url.searchParams.get("replayAfter");
  const replayAfterId =
    replayAfterRaw !== null && replayAfterRaw.length > 0
      ? Number.parseInt(replayAfterRaw, 10)
      : undefined;
  const upgraded = server.upgrade(req, {
    data: {
      channelId,
      ticket: minted.ticket,
      peerId,
      ...(replayAfterId !== undefined && Number.isFinite(replayAfterId) ? { replayAfterId } : {}),
    },
    ...(selectedProtocol !== undefined ? { protocol: selectedProtocol } : {}),
  });
  if (!upgraded) return jsonError("WebSocket upgrade failed", 500);
  return undefined;
}
