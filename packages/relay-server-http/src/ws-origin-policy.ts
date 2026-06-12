export const RELAY_WS_ALLOWED_ORIGINS_ENV = "RELAY_WS_ALLOWED_ORIGINS" as const;
export const RELAY_WS_ALLOW_MISSING_ORIGIN_ENV = "RELAY_WS_ALLOW_MISSING_ORIGIN" as const;

export type WsOriginPolicy = {
  allowedOrigins: ReadonlySet<string>;
  allowMissingOrigin: boolean;
};

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

export function wsOriginPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): WsOriginPolicy {
  const raw = env[RELAY_WS_ALLOWED_ORIGINS_ENV]?.trim();
  const allowedOrigins = new Set<string>();
  if (raw !== undefined && raw.length > 0) {
    for (const part of raw.split(",")) {
      const normalized = normalizeOrigin(part);
      if (normalized.length > 0) {
        allowedOrigins.add(normalized);
      }
    }
  }

  const missingRaw = env[RELAY_WS_ALLOW_MISSING_ORIGIN_ENV]?.trim().toLowerCase();
  const allowMissingOrigin =
    missingRaw === undefined ||
    missingRaw.length === 0 ||
    missingRaw === "1" ||
    missingRaw === "true" ||
    missingRaw === "yes";

  return { allowedOrigins, allowMissingOrigin };
}

export function checkWsUpgradeOrigin(req: Request, policy: WsOriginPolicy): boolean {
  const originHeader = req.headers.get("Origin");
  if (originHeader === null || originHeader.trim().length === 0) {
    return policy.allowMissingOrigin;
  }
  const origin = normalizeOrigin(originHeader);
  return policy.allowedOrigins.has(origin);
}
