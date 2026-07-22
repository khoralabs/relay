import {
  parseAppendKeyPackagesBody,
  parsePublishKeyPackagesBody,
} from "@khoralabs/relay/contracts";
import { base64UrlToBytes, bytesToBase64Url } from "@khoralabs/relay/crypto";

import { jsonError } from "../responses";
import type { RelayHttpDeps } from "./deps";
import {
  checkDefaultIpRateLimit,
  checkRateLimitResponse,
  readBoundedBody,
  requireAuthedDid,
} from "./request";

export const RELAY_KEY_PACKAGE_LOW_WARN_ENV = "RELAY_KEY_PACKAGE_LOW_WARN" as const;

const DEFAULT_LOW_WARN_THRESHOLD = 5;

export function keyPackageLowWarnThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[RELAY_KEY_PACKAGE_LOW_WARN_ENV]?.trim();
  if (raw === undefined || raw.length === 0) return DEFAULT_LOW_WARN_THRESHOLD;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOW_WARN_THRESHOLD;
}

export async function handlePublishKeyPackages(
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

  let body: ReturnType<typeof parsePublishKeyPackagesBody>;
  try {
    body = parsePublishKeyPackagesBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  const keyPackages = body.keyPackages.map((b64) => base64UrlToBytes(b64));
  deps.registry.publishKeyPackages(did, keyPackages, deps.now());
  return Response.json({ ok: true as const });
}

export async function handleFetchKeyPackage(
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

  const didCheck = await checkRateLimitResponse(deps.rateLimiters.keyPackageFetchDid, requesterDid);
  if (didCheck !== undefined) return didCheck;

  const result = deps.registry.fetchKeyPackage(targetDid);
  if (result === undefined) {
    return jsonError("key package not found", 404);
  }

  const { keyPackage, remainingKeyPackages, keyPackageClaimed } = result;
  const keyPackageDepleted = !keyPackageClaimed;
  const lowThreshold = keyPackageLowWarnThreshold();

  if (keyPackageDepleted) {
    console.warn(
      `[relay] key package fetch for ${targetDid} returned empty pool; requester=${requesterDid}`,
    );
  } else if (remainingKeyPackages <= lowThreshold) {
    console.warn(
      `[relay] key packages low for ${targetDid}: ${remainingKeyPackages} remaining; requester=${requesterDid}`,
    );
  }

  return Response.json({
    keyPackage: bytesToBase64Url(keyPackage),
    remainingKeyPackages,
    keyPackageDepleted,
  });
}

export async function handleKeyPackageStatus(
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

  return Response.json(deps.registry.getKeyPackagePoolStatus(did));
}

export async function handleAppendKeyPackages(
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

  let body: ReturnType<typeof parseAppendKeyPackagesBody>;
  try {
    body = parseAppendKeyPackagesBody(JSON.parse(bodyText) as unknown);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(msg, 400);
  }

  try {
    const keyPackages = body.keyPackages.map((b64) => base64UrlToBytes(b64));
    const remainingKeyPackages = deps.registry.appendKeyPackages(did, keyPackages, deps.now());
    return Response.json({ ok: true as const, remainingKeyPackages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "key package pool not published") {
      return jsonError(msg, 404);
    }
    return jsonError(msg, 400);
  }
}
