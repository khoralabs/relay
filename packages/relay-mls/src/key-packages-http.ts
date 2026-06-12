import type { RelaySigner } from "@khoralabs/relay-contracts";
import {
  type AppendKeyPackagesBody,
  type FetchedKeyPackage,
  type KeyPackagePoolStatus,
  type PublishKeyPackagesBody,
  parseFetchedKeyPackage,
  parseKeyPackagePoolStatus,
} from "@khoralabs/relay-contracts";

import { signedAgentFetch } from "./signed-http";

function httpError(statusText: string, j: unknown): string {
  if (typeof j === "object" && j !== null && "error" in j) {
    return String((j as { error: unknown }).error);
  }
  return statusText;
}

export async function publishKeyPackagesHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: PublishKeyPackagesBody,
): Promise<{ ok: true }> {
  const path = "/v1/key-packages";
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return j as { ok: true };
}

export async function getKeyPackageStatusHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
): Promise<KeyPackagePoolStatus> {
  const path = "/v1/key-packages/status";
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseKeyPackagePoolStatus(j);
}

export async function appendKeyPackagesHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: AppendKeyPackagesBody,
): Promise<{ ok: true; remainingKeyPackages: number }> {
  const path = "/v1/key-packages/batch";
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return j as { ok: true; remainingKeyPackages: number };
}

export async function fetchKeyPackageHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  did: string,
): Promise<FetchedKeyPackage> {
  const path = `/v1/key-packages/${encodeURIComponent(did)}`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseFetchedKeyPackage(j);
}
