import type { RelayHubWsData } from "../relay-hub";
import { jsonError } from "../responses";
import { handleChannelsCreate } from "./channels-create";
import { handleChannelsInviteJoin } from "./channels-join";
import type { RelayHttpDeps } from "./deps";
import { handleChannelMintJoinToken } from "./join-tokens";
import {
  handleAppendKeyPackages,
  handleFetchKeyPackage,
  handleKeyPackageStatus,
  handlePublishKeyPackages,
} from "./key-packages";
import { handleFetchMlsWelcome, handlePublishMlsWelcome } from "./mls-welcome";
import {
  channelActorPathRe,
  channelAllocatePathRe,
  channelJoinTokensPathRe,
  channelMlsWelcomePathRe,
  channelReleasePathRe,
  channelRosterPathRe,
  channelSessionStatusPathRe,
  channelTicketPathRe,
  channelWsNoncePathRe,
  channelWsPathRe,
  keyPackageDidPathRe,
  keyPackagesPathRe,
} from "./paths";
import { handleGetRoster, handleRegisterActor } from "./roster";
import { handleSessionAllocate, handleSessionRelease, handleSessionStatus } from "./sessions";
import { handleChannelMintTicket } from "./ticket";
import { handleChannelWsUpgrade } from "./ws";
import { handleChannelMintWsNonce } from "./ws-nonce";

export async function routeRelayHttp(
  deps: RelayHttpDeps,
  req: Request,
  server: Bun.Server<RelayHubWsData>,
): Promise<Response | undefined> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health") {
    return new Response("ok", { status: 200 });
  }

  if (req.method === "POST" && url.pathname === "/v1/channels/join") {
    return handleChannelsInviteJoin(deps, req, url, server);
  }

  if (req.method === "POST" && url.pathname === "/v1/channels") {
    if (deps.relayProfile.mode === "single") {
      return jsonError("channel spawn is orchestrator-only; this relay hosts one channel", 501);
    }
    return handleChannelsCreate(deps, req, url, server);
  }

  const allocateMatch = channelAllocatePathRe.exec(url.pathname);
  if (req.method === "POST" && allocateMatch !== null) {
    return handleSessionAllocate(deps, req, url, allocateMatch[1] as string, server);
  }

  const sessionStatusMatch = channelSessionStatusPathRe.exec(url.pathname);
  if (req.method === "GET" && sessionStatusMatch !== null) {
    return handleSessionStatus(
      deps,
      req,
      url,
      sessionStatusMatch[1] as string,
      sessionStatusMatch[2] as string,
      server,
    );
  }

  const releaseMatch = channelReleasePathRe.exec(url.pathname);
  if (req.method === "POST" && releaseMatch !== null) {
    return handleSessionRelease(
      deps,
      req,
      url,
      releaseMatch[1] as string,
      releaseMatch[2] as string,
      server,
    );
  }

  const mlsWelcomeMatch = channelMlsWelcomePathRe.exec(url.pathname);
  if (mlsWelcomeMatch !== null) {
    const channelId = mlsWelcomeMatch[1] as string;
    const sessionId = mlsWelcomeMatch[2] as string;
    if (req.method === "POST") {
      return handlePublishMlsWelcome(deps, req, url, channelId, sessionId, server);
    }
    if (req.method === "GET") {
      return handleFetchMlsWelcome(deps, req, url, channelId, sessionId, server);
    }
  }

  const ticketMatch = channelTicketPathRe.exec(url.pathname);
  if (req.method === "POST" && ticketMatch !== null) {
    return handleChannelMintTicket(deps, req, url, ticketMatch[1] as string, server);
  }

  const joinTokensMatch = channelJoinTokensPathRe.exec(url.pathname);
  if (req.method === "POST" && joinTokensMatch !== null) {
    return handleChannelMintJoinToken(deps, req, url, joinTokensMatch[1] as string, server);
  }

  const wsNonceMatch = channelWsNoncePathRe.exec(url.pathname);
  if (req.method === "POST" && wsNonceMatch !== null) {
    return handleChannelMintWsNonce(deps, req, url, wsNonceMatch[1] as string, server);
  }

  const actorMatch = channelActorPathRe.exec(url.pathname);
  if (req.method === "POST" && actorMatch !== null) {
    return handleRegisterActor(deps, req, url, actorMatch[1] as string, server);
  }

  const rosterMatch = channelRosterPathRe.exec(url.pathname);
  if (req.method === "GET" && rosterMatch !== null) {
    return handleGetRoster(deps, req, url, rosterMatch[1] as string, server);
  }

  if (req.method === "GET" && url.pathname === "/v1/key-packages/status") {
    return handleKeyPackageStatus(deps, req, url, server);
  }

  if (req.method === "POST" && url.pathname === "/v1/key-packages/batch") {
    return handleAppendKeyPackages(deps, req, url, server);
  }

  if (req.method === "POST" && keyPackagesPathRe.test(url.pathname)) {
    return handlePublishKeyPackages(deps, req, url, server);
  }

  const keyPackageDidMatch = keyPackageDidPathRe.exec(url.pathname);
  if (req.method === "GET" && keyPackageDidMatch !== null) {
    return handleFetchKeyPackage(
      deps,
      req,
      url,
      decodeURIComponent(keyPackageDidMatch[1] as string),
      server,
    );
  }

  const wsMatch = channelWsPathRe.exec(url.pathname);
  if (req.method === "GET" && wsMatch !== null) {
    const wsRes = await handleChannelWsUpgrade(deps, req, url, wsMatch[1] as string, server);
    if (wsRes !== undefined) return wsRes;
    return undefined;
  }

  return jsonError("Not found", 404);
}
