import { parseRegisterActorBody } from "@khoralabs/relay-contracts";

import { jsonError } from "../responses";
import { resolveChannelId } from "./channel-id";
import type { RelayHttpDeps } from "./deps";
import {
  checkDefaultIpRateLimit,
  readBoundedBody,
  requireAuthedDid,
  requireMember,
} from "./request";

export async function handleRegisterActor(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
): Promise<Response> {
  const ipCheck = checkDefaultIpRateLimit(req, deps.rateLimiters);
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

  let body: ReturnType<typeof parseRegisterActorBody>;
  try {
    body = parseRegisterActorBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  deps.registry.registerActor(channelId, did, body.actorPubkey, t);
  return Response.json({ ok: true as const });
}

export async function handleGetRoster(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  channelIdRaw: string,
): Promise<Response> {
  const ipCheck = checkDefaultIpRateLimit(req, deps.rateLimiters);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did } = authed;

  const channelId = resolveChannelId(deps, channelIdRaw);
  if (channelId instanceof Response) return channelId;
  const t = deps.now();
  const memberErr = requireMember(deps, channelId, did, t);
  if (memberErr !== undefined) return memberErr;

  return Response.json(deps.registry.getRosterSnapshot(channelId, t));
}
