import { parsePublishPreKeyBundleBody } from "@khoralabs/relay-crypto";

import { jsonError } from "../responses";
import type { RelayHttpDeps } from "./deps";
import { checkDefaultIpRateLimit, readBoundedBody, requireAuthedDid } from "./request";

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

export function handleFetchPreKeys(deps: RelayHttpDeps, _req: Request, did: string): Response {
  const bundle = deps.registry.fetchPreKeyBundle(did);
  if (bundle === undefined) {
    return jsonError("prekey bundle not found", 404);
  }
  return Response.json(bundle);
}
