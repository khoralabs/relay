import type { RelaySigner } from "@khoralabs/relay/contracts";
import {
  type FetchedMlsWelcome,
  type PublishMlsWelcomeBody,
  parseFetchedMlsWelcome,
} from "@khoralabs/relay/contracts";
import { signedAgentFetch } from "./signed-http";

function httpError(statusText: string, j: unknown): string {
  if (typeof j === "object" && j !== null && "error" in j) {
    return String((j as { error: unknown }).error);
  }
  return statusText;
}

export async function publishMlsWelcomeHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
  body: PublishMlsWelcomeBody,
): Promise<{ ok: true }> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}/mls-welcome`;
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

export async function fetchMlsWelcomeHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
): Promise<FetchedMlsWelcome> {
  const path = `/v1/channels/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}/mls-welcome`;
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(httpError(res.statusText, j));
  return parseFetchedMlsWelcome(j);
}
