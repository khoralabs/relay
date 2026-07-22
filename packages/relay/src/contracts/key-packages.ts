function obj(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`${name}: expected object`);
  }
  return v as Record<string, unknown>;
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`${field}: expected non-empty string`);
  }
  return v;
}

function posInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${field}: expected non-negative integer`);
  }
  return v;
}

export type PublishKeyPackagesBody = {
  keyPackages: string[];
};

export type AppendKeyPackagesBody = {
  keyPackages: string[];
};

export type KeyPackagePoolStatus = {
  published: boolean;
  remainingKeyPackages: number;
  nextKeyPackageId: number;
};

export type FetchedKeyPackage = {
  keyPackage: string;
  remainingKeyPackages: number;
  keyPackageDepleted: boolean;
};

export function parsePublishKeyPackagesBody(v: unknown): PublishKeyPackagesBody {
  const o = obj(v, "PublishKeyPackagesBody");
  const raw = o.keyPackages;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("keyPackages: expected non-empty array");
  }
  const keyPackages = raw.map((entry, i) => str(entry, `keyPackages[${i}]`));
  return { keyPackages };
}

export function parseAppendKeyPackagesBody(v: unknown): AppendKeyPackagesBody {
  return parsePublishKeyPackagesBody(v);
}

export function parseKeyPackagePoolStatus(v: unknown): KeyPackagePoolStatus {
  const o = obj(v, "KeyPackagePoolStatus");
  const published = o.published === true;
  return {
    published,
    remainingKeyPackages: posInt(o.remainingKeyPackages, "remainingKeyPackages"),
    nextKeyPackageId: posInt(o.nextKeyPackageId, "nextKeyPackageId"),
  };
}

export function parseFetchedKeyPackage(v: unknown): FetchedKeyPackage {
  const o = obj(v, "FetchedKeyPackage");
  return {
    keyPackage: str(o.keyPackage, "keyPackage"),
    remainingKeyPackages: posInt(o.remainingKeyPackages, "remainingKeyPackages"),
    keyPackageDepleted: o.keyPackageDepleted === true,
  };
}
