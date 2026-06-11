export type RelayIdentityProvider =
  | { kind: "did-file"; path?: string }
  | { kind: "registry-session"; registryUrl: string; sessionToken: string };
