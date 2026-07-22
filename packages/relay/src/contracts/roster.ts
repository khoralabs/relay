export type RosterMember = {
  principalUri: string;
  actorPubkey?: string;
  joinedAtMs: number;
  lastSeenMs?: number;
};

export type RosterSnapshot = {
  channelId: string;
  members: RosterMember[];
};

export type RegisterActorBody = {
  actorPubkey: string;
};

export type RegisterActorResponse = {
  ok: true;
};

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

export function parseRegisterActorBody(v: unknown): RegisterActorBody {
  const o = obj(v, "RegisterActorBody");
  return { actorPubkey: str(o.actorPubkey, "actorPubkey") };
}

export function parseRosterSnapshot(v: unknown): RosterSnapshot {
  const o = obj(v, "RosterSnapshot");
  const membersRaw = o.members;
  if (!Array.isArray(membersRaw)) throw new Error("members: expected array");
  const members: RosterMember[] = membersRaw.map((m, i) => {
    const row = obj(m, `members[${i}]`);
    const member: RosterMember = {
      principalUri: str(row.principalUri, "principalUri"),
      joinedAtMs: posInt(row.joinedAtMs, "joinedAtMs"),
    };
    if (typeof row.actorPubkey === "string" && row.actorPubkey.length > 0) {
      member.actorPubkey = row.actorPubkey;
    }
    if (typeof row.lastSeenMs === "number" && Number.isInteger(row.lastSeenMs)) {
      member.lastSeenMs = row.lastSeenMs;
    }
    return member;
  });
  return { channelId: str(o.channelId, "channelId"), members };
}
