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

export type PublishMlsWelcomeBody = {
  welcome: string;
};

export type FetchedMlsWelcome = {
  welcome: string;
};

export function parsePublishMlsWelcomeBody(v: unknown): PublishMlsWelcomeBody {
  const o = obj(v, "PublishMlsWelcomeBody");
  return { welcome: str(o.welcome, "welcome") };
}

export function parseFetchedMlsWelcome(v: unknown): FetchedMlsWelcome {
  const o = obj(v, "FetchedMlsWelcome");
  return { welcome: str(o.welcome, "welcome") };
}
