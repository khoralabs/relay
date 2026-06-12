import { parsePublishMlsWelcomeBody } from "@khoralabs/relay-contracts";
import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay-crypto";

import { jsonError } from "../responses";
import { resolveChannelId } from "./channel-id";
import type { RelayHttpDeps } from "./deps";
import {
  checkDefaultIpRateLimit,
  readBoundedBody,
  requireAuthedDid,
  requireMember,
} from "./request";

export async function handlePublishMlsWelcome(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
  sessionId: string,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const bodyText = await readBoundedBody(req);
  if (bodyText instanceof Response) return bodyText;

  const authed = await requireAuthedDid(deps.auth, req, url, bodyText);
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  const parties = deps.registry.getSessionParties(channelId, sessionId);
  if (parties === undefined) return jsonError("session not found", 404);
  if (parties.initiatorDid !== did) {
    return jsonError("only session initiator may publish welcome", 403);
  }

  deps.registry.purgeExpiredMlsWelcomes(t);

  let body: ReturnType<typeof parsePublishMlsWelcomeBody>;
  try {
    body = parsePublishMlsWelcomeBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  deps.registry.publishMlsWelcome({
    channelId,
    sessionId,
    publisherDid: did,
    welcome: base64UrlToBytes(body.welcome),
    route: body.route,
    nowMs: t,
  });
  return Response.json({ ok: true as const });
}

export async function handleFetchMlsWelcome(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
  sessionId: string,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  const parties = deps.registry.getSessionParties(channelId, sessionId);
  if (parties === undefined) return jsonError("session not found", 404);
  if (parties.partyA !== did && parties.partyB !== did) {
    return jsonError("not a session party", 403);
  }

  deps.registry.purgeExpiredMlsWelcomes(t);

  const fetched = deps.registry.fetchMlsWelcome(channelId, sessionId);
  if (fetched === undefined) return jsonError("welcome not found", 404);

  return Response.json({
    welcome: bytesToBase64Url(fetched.welcome),
    route: fetched.route,
  });
}
