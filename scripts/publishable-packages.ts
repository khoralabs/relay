/**
 * Ordered publishable packages for unified releases (dependency order).
 */
export type PublishablePackage = {
  name: string;
  dir: string;
};

export const PUBLISH_ORDER: PublishablePackage[] = [
  { name: "@khoralabs/relay", dir: "packages/relay" },
];

export function isSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}
