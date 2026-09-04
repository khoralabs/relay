import {
  parseRegisterActorBody,
  parseRelayChannelCreateResponse,
  parseRelayChannelJoinResponse,
  parseRelayChannelTicketResponse,
  parseRelayChannelWsNonceResponse,
  parseRelaySessionAllocateResponse,
  parseRelaySessionStatusResponse,
  parseRosterSnapshot,
  RELAY_HTTP_PATH,
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
  relayChannelActorPath,
  relayChannelAllocatePath,
  relayChannelReleasePath,
  relayChannelRosterPath,
  relayChannelSessionPath,
  relayChannelTicketPath,
  relayChannelWsNoncePath,
} from "@khoralabs/relay/contracts";

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
    path: RELAY_HTTP_PATH.channels,
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
    path: RELAY_HTTP_PATH.channelsJoin,
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
  const path = relayChannelTicketPath(channelId);
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
  const path = relayChannelAllocatePath(channelId);
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
  const path = relayChannelWsNoncePath(channelId);
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
  const path = relayChannelSessionPath(channelId, sessionId);
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
  const path = relayChannelReleasePath(channelId, sessionId);
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
  const path = relayChannelActorPath(channelId);
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
  const path = relayChannelRosterPath(channelId);
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
