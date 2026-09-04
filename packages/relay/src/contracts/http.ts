/** HTTP path constants shared by relay client, MLS HTTP helpers, and server router. */

export const RELAY_HTTP_PATH = {
  health: "/health",
  channels: "/v1/channels",
  channelsJoin: "/v1/channels/join",
  keyPackages: "/v1/key-packages",
  keyPackagesStatus: "/v1/key-packages/status",
  keyPackagesBatch: "/v1/key-packages/batch",
} as const;

export type RelayHttpPathKey = keyof typeof RELAY_HTTP_PATH;

export function relayChannelTicketPath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/ticket`;
}

export function relayChannelJoinTokensPath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/join-tokens`;
}

export function relayChannelWsNoncePath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/ws-nonce`;
}

export function relayChannelWsPath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/ws`;
}

export function relayChannelAllocatePath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/sessions/allocate`;
}

export function relayChannelSessionPath(channelId: string, sessionId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}`;
}

export function relayChannelReleasePath(channelId: string, sessionId: string): string {
  return `${relayChannelSessionPath(channelId, sessionId)}/release`;
}

export function relayChannelActorPath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/actor`;
}

export function relayChannelRosterPath(channelId: string): string {
  return `${RELAY_HTTP_PATH.channels}/${encodeURIComponent(channelId)}/roster`;
}

export function relayChannelMlsWelcomePath(channelId: string, sessionId: string): string {
  return `${relayChannelSessionPath(channelId, sessionId)}/mls-welcome`;
}

export function relayKeyPackageDidPath(did: string): string {
  return `${RELAY_HTTP_PATH.keyPackages}/${encodeURIComponent(did)}`;
}

/** Unencoded path templates for building server matchers (do not use for signed requests). */
export const RELAY_HTTP_PATH_TEMPLATE = {
  channelWs: "/v1/channels/:channelId/ws",
  channelTicket: "/v1/channels/:channelId/ticket",
  channelJoinTokens: "/v1/channels/:channelId/join-tokens",
  channelWsNonce: "/v1/channels/:channelId/ws-nonce",
  channelAllocate: "/v1/channels/:channelId/sessions/allocate",
  channelSession: "/v1/channels/:channelId/sessions/:sessionId",
  channelRelease: "/v1/channels/:channelId/sessions/:sessionId/release",
  channelActor: "/v1/channels/:channelId/actor",
  channelRoster: "/v1/channels/:channelId/roster",
  channelMlsWelcome: "/v1/channels/:channelId/sessions/:sessionId/mls-welcome",
  keyPackageDid: "/v1/key-packages/:did",
} as const;
