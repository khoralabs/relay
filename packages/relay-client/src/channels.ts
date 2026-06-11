import {
  parseRegisterActorBody,
  parseRelayChannelCreateResponse,
  parseRelayChannelJoinResponse,
  parseRelayChannelTicketResponse,
  parseRelayChannelWsNonceResponse,
  parseRelaySessionAllocateResponse,
  parseRelaySessionStatusResponse,
  parseRosterSnapshot,
  type RegisterActorResponse,
  type RelayChannelCreateBody,
  type RelayChannelCreateResponse,
  type RelayChannelJoinBody,
  type RelayChannelJoinResponse,
  type RelayChannelTicketResponse,
  type RelayChannelWsNonceResponse,
  type RelaySessionAllocateBody,
  type RelaySessionAllocateResponse,
  type RelaySigner,
  type RosterSnapshot,
} from "@khoralabs/relay-contracts";
import {
  type PreKeyBundle,
  type PublishPreKeyBundleBody,
  parsePreKeyBundle,
} from "@khoralabs/relay-crypto";

import { signedAgentFetch } from "./agent-sign";

function httpError(statusText: string, j: unknown): string {
  if (typeof j === "object" && j !== null && "error" in j) {
    return String((j as { error: unknown }).error);
  }
  return statusText;
}

export async function createChannelHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: RelayChannelCreateBody = {},
): Promise<RelayChannelCreateResponse> {
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path: "/v1/channels",
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRelayChannelCreateResponse(j);
}

export async function joinChannelHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: RelayChannelJoinBody,
): Promise<RelayChannelJoinResponse> {
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path: "/v1/channels/join",
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRelayChannelJoinResponse(j);
}

export async function mintChannelTicketHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
): Promise<RelayChannelTicketResponse> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/ticket`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText: "{}",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRelayChannelTicketResponse(j);
}

export async function allocateSessionHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  body: RelaySessionAllocateBody,
): Promise<RelaySessionAllocateResponse> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/sessions/allocate`;
  const bodyText = JSON.stringify(body);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRelaySessionAllocateResponse(j);
}

export async function mintWsNonceHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
): Promise<RelayChannelWsNonceResponse> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/ws-nonce`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText: "{}",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRelayChannelWsNonceResponse(j);
}

export async function isSessionAllocatedHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
): Promise<boolean> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  if (!res.ok) return false;
  parseRelaySessionStatusResponse(await res.json());
  return true;
}

export async function releaseSessionHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
): Promise<{ ok: true }> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}/release`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText: "{}",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return j as { ok: true };
}

export async function registerActorHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  actorPubkey: string,
): Promise<RegisterActorResponse> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/actor`;
  const bodyText = JSON.stringify(parseRegisterActorBody({ actorPubkey }));
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "POST",
    path,
    bodyText,
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return j as RegisterActorResponse;
}

export async function getRosterHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
): Promise<RosterSnapshot> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/roster`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseRosterSnapshot(j);
}

export async function publishPreKeysHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  body: PublishPreKeyBundleBody,
): Promise<{ ok: true }> {
  const path = "/v1/prekeys";
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

export async function fetchPreKeysHttp(relayBaseUrl: string, did: string): Promise<PreKeyBundle> {
  const path = `/v1/prekeys/${encodeURIComponent(did)}`;
  const res = await fetch(new URL(path, relayBaseUrl.replace(/\/$/, "")));
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parsePreKeyBundle(j);
}
