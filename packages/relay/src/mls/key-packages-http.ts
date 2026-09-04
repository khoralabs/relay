import type { RelaySigner } from "@khoralabs/relay/contracts";
import {
  type AppendKeyPackagesBody,
  type FetchedKeyPackage,
  type KeyPackagePoolStatus,
  type PublishKeyPackagesBody,
  parseFetchedKeyPackage,
  parseKeyPackagePoolStatus,
  RELAY_HTTP_PATH,
  relayKeyPackageDidPath,
} from "@khoralabs/relay/contracts";

import { throwRelayHttpError } from "../client/errors";
import { signedAgentFetch } from "./signed-http";

export async function publishKeyPackagesHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: PublishKeyPackagesBody,
): Promise<{ ok: true }> {
  const path = RELAY_HTTP_PATH.keyPackages;
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throwRelayHttpError(res.status, res.statusText, j);
  return j as { ok: true };
}

export async function getKeyPackageStatusHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
): Promise<KeyPackagePoolStatus> {
  const path = RELAY_HTTP_PATH.keyPackagesStatus;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throwRelayHttpError(res.status, res.statusText, j);
  return parseKeyPackagePoolStatus(j);
}

export async function appendKeyPackagesHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: AppendKeyPackagesBody,
): Promise<{ ok: true; remainingKeyPackages: number }> {
  const path = RELAY_HTTP_PATH.keyPackagesBatch;
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throwRelayHttpError(res.status, res.statusText, j);
  return j as { ok: true; remainingKeyPackages: number };
}

export async function fetchKeyPackageHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  did: string,
): Promise<FetchedKeyPackage> {
  const path = relayKeyPackageDidPath(did);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throwRelayHttpError(res.status, res.statusText, j);
  return parseFetchedKeyPackage(j);
}
