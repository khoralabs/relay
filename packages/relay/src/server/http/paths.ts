import { RELAY_HTTP_PATH } from "../../contracts/http";

/** Path regexes derived from {@link RELAY_HTTP_PATH} / channel path builders. */

export const channelWsPathRe = /^\/v1\/channels\/([^/]+)\/ws$/;
export const channelTicketPathRe = /^\/v1\/channels\/([^/]+)\/ticket$/;
export const channelJoinTokensPathRe = /^\/v1\/channels\/([^/]+)\/join-tokens$/;
export const channelWsNoncePathRe = /^\/v1\/channels\/([^/]+)\/ws-nonce$/;
export const channelAllocatePathRe = /^\/v1\/channels\/([^/]+)\/sessions\/allocate$/;
export const channelSessionStatusPathRe = /^\/v1\/channels\/([^/]+)\/sessions\/([^/]+)$/;
export const channelReleasePathRe = /^\/v1\/channels\/([^/]+)\/sessions\/([^/]+)\/release$/;
export const channelActorPathRe = /^\/v1\/channels\/([^/]+)\/actor$/;
export const channelRosterPathRe = /^\/v1\/channels\/([^/]+)\/roster$/;
export const keyPackagesPathRe = new RegExp(
  `^${RELAY_HTTP_PATH.keyPackages.replace(/\//g, "\\/")}$`,
);
export const keyPackageDidPathRe = /^\/v1\/key-packages\/([^/]+)$/;
export const channelMlsWelcomePathRe = /^\/v1\/channels\/([^/]+)\/sessions\/([^/]+)\/mls-welcome$/;

export { RELAY_HTTP_PATH };
