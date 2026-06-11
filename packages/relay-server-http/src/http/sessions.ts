import {
  parseRelaySessionAllocateBody,
  type RelaySessionAllocateBody,
} from "@khoralabs/relay-contracts";

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

export async function handleSessionAllocate(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const bodyRead = await readBoundedBody(req);
  if (bodyRead instanceof Response) return bodyRead;
  const bodyText = bodyRead;

  const authed = await requireAuthedDid(deps.auth, req, url, bodyText);
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const didCheck = await checkRateLimitResponse(deps.rateLimiters.channelsAllocateDid, did);
  if (didCheck !== undefined) return didCheck;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  let parsed: RelaySessionAllocateBody;
  try {
    parsed = parseRelaySessionAllocateBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON body";
    return jsonError(msg, 400);
  }

  const channel = deps.registry.getChannel(channelId, t);
  if (channel === undefined) return jsonError("Channel not found or expired", 404);
  if (!deps.registry.isActiveMember(channelId, parsed.counterpartyDid)) {
    return jsonError("counterparty not a member", 400);
  }
  if (parsed.counterpartyDid === did) {
    return jsonError("counterparty must differ from caller", 400);
  }

  const result = deps.registry.allocateSession({
    channelId,
    sessionId: parsed.sessionId,
    partyADid: did,
    partyBDid: parsed.counterpartyDid,
    maxSessions: channel.maxSessions,
    createdAtMs: t,
  });
  if (!result.ok) return jsonError(result.reason, 409);
  return Response.json({ ok: true as const, sessionId: parsed.sessionId });
}

export async function handleSessionStatus(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
  sessionIdRaw: string,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const sessionId = decodeURIComponent(sessionIdRaw);
  if (sessionId === "allocate") return jsonError("Not found", 404);

  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  if (!deps.registry.isSessionAllocated(channelId, sessionId)) {
    return jsonError("session slot not allocated", 404);
  }
  return Response.json({ allocated: true as const, sessionId });
}

export async function handleSessionRelease(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
  sessionIdRaw: string,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const sessionId = decodeURIComponent(sessionIdRaw);
  const ok = deps.registry.releaseSession(channelId, sessionId, did);
  if (!ok) return jsonError("session slot not found", 404);
  return Response.json({ ok: true as const });
}
