import type { RelaySigner } from "@khoralabs/relay/contracts";
import {
  type FetchedMlsWelcome,
  type PublishMlsWelcomeBody,
  parseFetchedMlsWelcome,
  relayChannelMlsWelcomePath,
} from "@khoralabs/relay/contracts";

import { throwRelayHttpError } from "../client/errors";
import { signedAgentFetch } from "./signed-http";

export async function publishMlsWelcomeHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
  body: PublishMlsWelcomeBody,
): Promise<{ ok: true }> {
  const path = relayChannelMlsWelcomePath(channelId, sessionId);
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

export async function fetchMlsWelcomeHttp(
  relayBaseUrl: string,
  signer: RelaySigner,
  channelId: string,
  sessionId: string,
): Promise<FetchedMlsWelcome> {
  const path = relayChannelMlsWelcomePath(channelId, sessionId);
  const res = await signedAgentFetch(relayBaseUrl, {
    method: "GET",
    path,
    bodyText: "",
    signer,
  });
  const j: unknown = await res.json().catch(() => null);
  if (!res.ok) throwRelayHttpError(res.status, res.statusText, j);
  return parseFetchedMlsWelcome(j);
}
