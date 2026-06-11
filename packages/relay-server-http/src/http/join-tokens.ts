import { randomInviteToken } from "../invites";
import { jsonError } from "../responses";
import { resolveChannelId } from "./channel-id";
import type { RelayHttpDeps } from "./deps";
import {
  checkDefaultIpRateLimit,
  checkRateLimitResponse,
  readBoundedBody,
  requireAuthedDid,
  requireMember,
} from "./request";

export async function handleChannelMintJoinToken(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const bodyRead = await readBoundedBody(req);
  if (bodyRead instanceof Response) return bodyRead;

  const authed = await requireAuthedDid(deps.auth, req, url, bodyRead);
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const didCheck = await checkRateLimitResponse(deps.rateLimiters.channelsTicketMintDid, did);
  if (didCheck !== undefined) return didCheck;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;

  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  const channel = deps.registry.getChannel(channelId, t);
  if (channel === undefined) return jsonError("Channel not found or expired", 404);

  const joinToken = randomInviteToken();
  deps.registry.putInvite(joinToken, {
    channelId,
    creatorDid: did,
    expiresAtMs: channel.expiresAtMs,
  });

  return Response.json({
    channelId,
    joinToken,
    expiresAtMs: channel.expiresAtMs,
  });
}
