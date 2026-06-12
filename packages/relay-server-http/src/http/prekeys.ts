import {
  parseAppendOneTimePreKeysBody,
  parsePublishPreKeyBundleBody,
} from "@khoralabs/relay-crypto";

import { jsonError } from "../responses";
import type { RelayHttpDeps } from "./deps";
import {
  checkDefaultIpRateLimit,
  checkRateLimitResponse,
  readBoundedBody,
  requireAuthedDid,
} from "./request";

export const RELAY_PREKEY_LOW_OTK_WARN_ENV = "RELAY_PREKEY_LOW_OTK_WARN" as const;

const DEFAULT_LOW_OTK_WARN_THRESHOLD = 5;

export function prekeyLowOtkWarnThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[RELAY_PREKEY_LOW_OTK_WARN_ENV]?.trim();
  if (raw === undefined || raw.length === 0) return DEFAULT_LOW_OTK_WARN_THRESHOLD;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOW_OTK_WARN_THRESHOLD;
}

export async function handlePublishPreKeys(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const bodyText = await readBoundedBody(req);
  if (bodyText instanceof Response) return bodyText;

  const authed = await requireAuthedDid(deps.auth, req, url, bodyText);
  if (authed instanceof Response) return authed;
  const { did } = authed;

  let body: ReturnType<typeof parsePublishPreKeyBundleBody>;
  try {
    body = parsePublishPreKeyBundleBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  deps.registry.publishPreKeyBundle(did, body, deps.now());
  return Response.json({ ok: true as const });
}

export async function handleFetchPreKeys(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  targetDid: string,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did: requesterDid } = authed;

  const didCheck = await checkRateLimitResponse(deps.rateLimiters.prekeysFetchDid, requesterDid);
  if (didCheck !== undefined) return didCheck;

  const result = deps.registry.fetchPreKeyBundle(targetDid);
  if (result === undefined) {
    return jsonError("prekey bundle not found", 404);
  }

  const { bundle, remainingOneTimePreKeys, oneTimePreKeyClaimed } = result;
  const oneTimePreKeyDepleted = !oneTimePreKeyClaimed;
  const lowThreshold = prekeyLowOtkWarnThreshold();

  if (oneTimePreKeyDepleted) {
    console.warn(
      `[relay] prekey fetch for ${targetDid} returned no one-time prekey (remaining=0); X3DH will use SPK-only path; requester=${requesterDid}`,
    );
  } else if (remainingOneTimePreKeys <= lowThreshold) {
    console.warn(
      `[relay] prekey one-time prekeys low for ${targetDid}: ${remainingOneTimePreKeys} remaining after claim; requester=${requesterDid}`,
    );
  }

  return Response.json({
    ...bundle,
    remainingOneTimePreKeys,
    oneTimePreKeyDepleted,
  });
}

export async function handlePreKeyStatus(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const authed = await requireAuthedDid(deps.auth, req, url, "");
  if (authed instanceof Response) return authed;
  const { did } = authed;

  return Response.json(deps.registry.getPreKeyBundleStatus(did));
}

export async function handleAppendOneTimePreKeys(
  deps: RelayHttpDeps,
  req: Request,
  url: URL,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const ipCheck = await checkDefaultIpRateLimit(deps, req, server);
  if (ipCheck !== undefined) return ipCheck;

  const bodyText = await readBoundedBody(req);
  if (bodyText instanceof Response) return bodyText;

  const authed = await requireAuthedDid(deps.auth, req, url, bodyText);
  if (authed instanceof Response) return authed;
  const { did } = authed;

  let body: ReturnType<typeof parseAppendOneTimePreKeysBody>;
  try {
    body = parseAppendOneTimePreKeysBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  try {
    const remainingOneTimePreKeys = deps.registry.appendOneTimePreKeys(did, body.oneTimePreKeys);
    return Response.json({ ok: true as const, remainingOneTimePreKeys });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "prekey bundle not published") {
      return jsonError(msg, 404);
    }
    return jsonError(msg, 400);
  }
}
