import type { Database } from "bun:sqlite";
import {
  DEFAULT_WS_UPGRADE_NONCE_TTL_MS,
  hashWsUpgradeNonce,
  randomWsUpgradeNonce,
} from "@khoralabs/relay/admission";
import {
  DEFAULT_RELAY_SESSION_QUOTA,
  type RelayAdmissionMode,
  type RelayChannelPolicy,
  type RelaySessionQuota,
  type RosterSnapshot,
} from "@khoralabs/relay/contracts";
import { hashInviteToken } from "../../invites";

export type KeyPackageFetchResult = {
  keyPackage: Uint8Array;
  remainingKeyPackages: number;
  keyPackageClaimed: boolean;
};

export type KeyPackagePoolStatus = {
  published: boolean;
  remainingKeyPackages: number;
  nextKeyPackageId: number;
};

export type ChannelRow = {
  channelId: string;
  creatorDid: string;
  admissionMode: RelayAdmissionMode;
  maxPopulation: number | null;
  maxSessions: RelaySessionQuota;
  expiresAtMs: number;
  createdAtMs: number;
};

export function isRosterAtCapacity(memberCount: number, maxPopulation: number | null): boolean {
  return maxPopulation !== null && memberCount >= maxPopulation;
}

function rowToMaxChains(mode: string, measure: number | null): RelaySessionQuota {
  if (mode === "global") {
    return { mode: "global", measure: measure ?? 1 };
  }
  return { mode: "principal", measure: measure ?? 1 };
}

function maxSessionsToDb(maxSessions: RelaySessionQuota): { mode: string; measure: number | null } {
  return { mode: maxSessions.mode, measure: maxSessions.measure };
}

function initialChainQuota(maxSessions: RelaySessionQuota): number | null {
  if (maxSessions.mode === "principal") return maxSessions.measure;
  return null;
}

export function createChannelRegistry(db: Database) {
  const insertChannelStmt = db.prepare(
    `INSERT INTO channels (
      channel_id, creator_did, admission_mode, max_population,
      session_limit_mode, session_limit_measure, expires_at_ms, created_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMemberStmt = db.prepare(
    `INSERT INTO channel_members (channel_id, principal_did, role, status, session_quota, joined_at_ms)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(channel_id, principal_did) DO UPDATE SET
       status = excluded.status,
       session_quota = excluded.session_quota,
       joined_at_ms = excluded.joined_at_ms`,
  );
  const insertInviteStmt = db.prepare(
    `INSERT INTO channel_invites (token_hash, channel_id, creator_did, expires_at_ms)
     VALUES (?, ?, ?, ?)`,
  );
  const redeemInviteStmt = db.prepare(
    `UPDATE channel_invites SET redeemed_at_ms = ?, redeemed_by_did = ? WHERE token_hash = ?`,
  );
  const insertChainStmt = db.prepare(
    `INSERT INTO channel_sessions (session_id, channel_id, party_a_did, party_b_did, initiator_did, status, created_at_ms)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  );
  const releaseSessionStmt = db.prepare(
    `UPDATE channel_sessions SET status = 'released' WHERE channel_id = ? AND session_id = ?`,
  );
  const insertWsNonceStmt = db.prepare(
    `INSERT INTO ws_upgrade_nonces (nonce_hash, channel_id, expires_at_ms, created_at_ms)
     VALUES (?, ?, ?, ?)`,
  );
  const consumeWsNonceStmt = db.prepare(
    `UPDATE ws_upgrade_nonces SET consumed_at_ms = ?
     WHERE nonce_hash = ? AND channel_id = ? AND consumed_at_ms IS NULL AND expires_at_ms > ?`,
  );
  const deleteMlsWelcomeStmt = db.prepare(
    `DELETE FROM relay_mls_welcomes WHERE channel_id = ? AND session_id = ?`,
  );

  return {
    countActiveChannels(nowMs: number): number {
      const row = db
        .query<{ c: number }, [number]>(
          `SELECT COUNT(*) AS c FROM channels WHERE expires_at_ms > ?`,
        )
        .get(nowMs);
      return row?.c ?? 0;
    },

    insertChannel(input: {
      channelId: string;
      creatorDid: string;
      admissionMode: RelayAdmissionMode;
      maxPopulation: number | null;
      maxSessions: RelaySessionQuota;
      expiresAtMs: number;
      createdAtMs: number;
    }): void {
      const { mode, measure } = maxSessionsToDb(input.maxSessions);
      insertChannelStmt.run(
        input.channelId,
        input.creatorDid,
        input.admissionMode,
        input.maxPopulation,
        mode,
        measure,
        input.expiresAtMs,
        input.createdAtMs,
      );
      const quota = initialChainQuota(input.maxSessions);
      insertMemberStmt.run(
        input.channelId,
        input.creatorDid,
        "creator",
        "active",
        quota,
        input.createdAtMs,
      );
    },

    getChannel(channelId: string, nowMs: number): ChannelRow | undefined {
      const row = db
        .query<
          {
            channel_id: string;
            creator_did: string;
            admission_mode: string;
            max_population: number | null;
            session_limit_mode: string;
            session_limit_measure: number | null;
            expires_at_ms: number;
            created_at_ms: number;
          },
          [string, number]
        >(
          `SELECT channel_id, creator_did, admission_mode, max_population,
                  session_limit_mode, session_limit_measure, expires_at_ms, created_at_ms
           FROM channels WHERE channel_id = ? AND expires_at_ms > ?`,
        )
        .get(channelId, nowMs);
      if (row === undefined || row === null) return undefined;
      return {
        channelId: row.channel_id,
        creatorDid: row.creator_did,
        admissionMode: row.admission_mode as RelayAdmissionMode,
        maxPopulation: row.max_population,
        maxSessions: rowToMaxChains(row.session_limit_mode, row.session_limit_measure),
        expiresAtMs: row.expires_at_ms,
        createdAtMs: row.created_at_ms,
      };
    },

    channelPolicy(channel: ChannelRow): RelayChannelPolicy {
      return {
        admissionMode: channel.admissionMode,
        ...(channel.maxPopulation !== null ? { maxPopulation: channel.maxPopulation } : {}),
        maxSessions: channel.maxSessions,
      };
    },

    isActiveMember(channelId: string, principalDid: string): boolean {
      const row = db
        .query<{ c: number }, [string, string]>(
          `SELECT COUNT(*) AS c FROM channel_members
           WHERE channel_id = ? AND principal_did = ? AND status = 'active'`,
        )
        .get(channelId, principalDid);
      return (row?.c ?? 0) > 0;
    },

    countActiveMembers(channelId: string): number {
      const row = db
        .query<{ c: number }, [string]>(
          `SELECT COUNT(*) AS c FROM channel_members WHERE channel_id = ? AND status = 'active'`,
        )
        .get(channelId);
      return row?.c ?? 0;
    },

    addMember(input: {
      channelId: string;
      principalDid: string;
      maxSessions: RelaySessionQuota;
      joinedAtMs: number;
    }): void {
      const quota = initialChainQuota(input.maxSessions);
      insertMemberStmt.run(
        input.channelId,
        input.principalDid,
        "member",
        "active",
        quota,
        input.joinedAtMs,
      );
    },

    putInvite(
      token: string,
      input: {
        channelId: string;
        creatorDid: string;
        expiresAtMs: number;
      },
    ): void {
      insertInviteStmt.run(
        hashInviteToken(token),
        input.channelId,
        input.creatorDid,
        input.expiresAtMs,
      );
    },

    redeemInvite(
      token: string,
      consumerDid: string,
      nowMs: number,
    ): { channelId: string; creatorDid: string } | undefined {
      const hash = hashInviteToken(token);
      const row = db
        .query<
          {
            channel_id: string;
            creator_did: string;
            expires_at_ms: number;
            redeemed_at_ms: number | null;
          },
          [string]
        >(
          `SELECT channel_id, creator_did, expires_at_ms, redeemed_at_ms FROM channel_invites WHERE token_hash = ?`,
        )
        .get(hash);
      if (row === undefined || row === null) return undefined;
      if (row.expires_at_ms <= nowMs) return undefined;
      if (row.redeemed_at_ms !== null) return undefined;
      redeemInviteStmt.run(nowMs, consumerDid, hash);
      return { channelId: row.channel_id, creatorDid: row.creator_did };
    },

    getMemberSessionQuota(channelId: string, principalDid: string): number | null | undefined {
      const row = db
        .query<{ session_quota: number | null }, [string, string]>(
          `SELECT session_quota FROM channel_members
           WHERE channel_id = ? AND principal_did = ? AND status = 'active'`,
        )
        .get(channelId, principalDid);
      if (row === undefined || row === null) return undefined;
      return row.session_quota;
    },

    countActiveSessions(channelId: string): number {
      const row = db
        .query<{ c: number }, [string]>(
          `SELECT COUNT(*) AS c FROM channel_sessions WHERE channel_id = ? AND status = 'active'`,
        )
        .get(channelId);
      return row?.c ?? 0;
    },

    countActiveSessionsForMember(channelId: string, principalDid: string): number {
      const row = db
        .query<{ c: number }, [string, string, string]>(
          `SELECT COUNT(*) AS c FROM channel_sessions
           WHERE channel_id = ? AND status = 'active'
             AND (party_a_did = ? OR party_b_did = ?)`,
        )
        .get(channelId, principalDid, principalDid);
      return row?.c ?? 0;
    },

    allocateSession(input: {
      channelId: string;
      sessionId: string;
      /** Allocate caller (MLS group initiator); not necessarily lexicographically smaller than counterparty. */
      initiatorDid: string;
      partyADid: string;
      partyBDid: string;
      maxSessions: RelaySessionQuota;
      createdAtMs: number;
    }): { ok: true } | { ok: false; reason: string } {
      const [a, b] =
        input.partyADid < input.partyBDid
          ? [input.partyADid, input.partyBDid]
          : [input.partyBDid, input.partyADid];

      db.run("BEGIN IMMEDIATE");
      let outcome: { ok: true } | { ok: false; reason: string };
      try {
        if (input.maxSessions.mode === "global") {
          const total = this.countActiveSessions(input.channelId);
          if (total >= input.maxSessions.measure) {
            outcome = { ok: false, reason: "channel session capacity reached" };
          } else {
            insertChainStmt.run(
              input.sessionId,
              input.channelId,
              a,
              b,
              input.initiatorDid,
              input.createdAtMs,
            );
            outcome = { ok: true };
          }
        } else {
          outcome = { ok: true };
          for (const did of [a, b]) {
            const quota = this.getMemberSessionQuota(input.channelId, did);
            if (quota === undefined) {
              outcome = { ok: false, reason: "member not found" };
              break;
            }
            if (quota === null) {
              continue;
            }
            if (quota <= 0) {
              outcome = { ok: false, reason: "member session budget not allocated" };
              break;
            }
            const used = this.countActiveSessionsForMember(input.channelId, did);
            if (used >= quota) {
              outcome = { ok: false, reason: "member session quota exceeded" };
              break;
            }
          }
          if (outcome.ok) {
            insertChainStmt.run(
              input.sessionId,
              input.channelId,
              a,
              b,
              input.initiatorDid,
              input.createdAtMs,
            );
          }
        }

        if (outcome.ok) {
          db.run("COMMIT");
        } else {
          db.run("ROLLBACK");
        }
        return outcome;
      } catch {
        db.run("ROLLBACK");
        return { ok: false, reason: "session slot already allocated" };
      }
    },

    releaseSession(channelId: string, sessionId: string, principalDid: string): boolean {
      const row = db
        .query<{ party_a_did: string; party_b_did: string; status: string }, [string, string]>(
          `SELECT party_a_did, party_b_did, status FROM channel_sessions
           WHERE channel_id = ? AND session_id = ?`,
        )
        .get(channelId, sessionId);
      if (row === undefined || row === null || row.status !== "active") return false;
      if (row.party_a_did !== principalDid && row.party_b_did !== principalDid) {
        return false;
      }
      releaseSessionStmt.run(channelId, sessionId);
      deleteMlsWelcomeStmt.run(channelId, sessionId);
      return true;
    },

    isSessionAllocated(channelId: string, sessionId: string): boolean {
      const row = db
        .query<{ c: number }, [string, string]>(
          `SELECT COUNT(*) AS c FROM channel_sessions
           WHERE channel_id = ? AND session_id = ? AND status = 'active'`,
        )
        .get(channelId, sessionId);
      return (row?.c ?? 0) > 0;
    },

    mintWsUpgradeNonce(
      channelId: string,
      channelExpiresAtMs: number,
      nowMs: number,
    ): { nonce: string; expiresAtMs: number } {
      db.run(`DELETE FROM ws_upgrade_nonces WHERE expires_at_ms <= ?`, [nowMs]);
      const nonce = randomWsUpgradeNonce();
      const expiresAtMs = Math.min(channelExpiresAtMs, nowMs + DEFAULT_WS_UPGRADE_NONCE_TTL_MS);
      insertWsNonceStmt.run(hashWsUpgradeNonce(nonce), channelId, expiresAtMs, nowMs);
      return { nonce, expiresAtMs };
    },

    consumeWsUpgradeNonce(channelId: string, nonce: string, nowMs: number): boolean {
      const result = consumeWsNonceStmt.run(nowMs, hashWsUpgradeNonce(nonce), channelId, nowMs);
      return result.changes > 0;
    },

    registerActor(
      channelId: string,
      principalDid: string,
      actorPubkey: string,
      nowMs: number,
    ): void {
      db.run(
        `INSERT INTO channel_member_actors (channel_id, principal_did, actor_pubkey, registered_at_ms)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(channel_id, principal_did) DO UPDATE SET
           actor_pubkey = excluded.actor_pubkey,
           registered_at_ms = excluded.registered_at_ms`,
        [channelId, principalDid, actorPubkey, nowMs],
      );
    },

    getRosterSnapshot(channelId: string, _nowMs: number): RosterSnapshot {
      const rows = db
        .query<
          {
            principal_did: string;
            actor_pubkey: string | null;
            joined_at_ms: number;
          },
          [string]
        >(
          `SELECT m.principal_did, a.actor_pubkey, m.joined_at_ms
           FROM channel_members m
           LEFT JOIN channel_member_actors a
             ON m.channel_id = a.channel_id AND m.principal_did = a.principal_did
           WHERE m.channel_id = ? AND m.status = 'active'`,
        )
        .all(channelId);
      return {
        channelId,
        members: rows.map((r) => ({
          principalUri: r.principal_did,
          joinedAtMs: r.joined_at_ms,
          ...(r.actor_pubkey !== null && r.actor_pubkey.length > 0
            ? { actorPubkey: r.actor_pubkey }
            : {}),
        })),
      };
    },

    publishKeyPackages(did: string, keyPackages: Uint8Array[], nowMs: number): void {
      db.run("BEGIN");
      try {
        db.run(`DELETE FROM relay_key_packages WHERE principal_did = ? AND claimed = 0`, [did]);
        const insert = db.prepare(
          `INSERT INTO relay_key_packages (principal_did, key_package, claimed, created_ms)
           VALUES (?, ?, 0, ?)`,
        );
        for (const kp of keyPackages) {
          insert.run(did, kp, nowMs);
        }
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },

    getKeyPackagePoolStatus(did: string): KeyPackagePoolStatus {
      const remainingKeyPackages =
        db
          .query<{ n: number }, [string]>(
            `SELECT COUNT(*) AS n FROM relay_key_packages WHERE principal_did = ? AND claimed = 0`,
          )
          .get(did)?.n ?? 0;

      const maxId =
        db
          .query<{ max_id: number | null }, [string]>(
            `SELECT MAX(id) AS max_id FROM relay_key_packages WHERE principal_did = ?`,
          )
          .get(did)?.max_id ?? null;

      return {
        published: maxId !== null,
        remainingKeyPackages,
        nextKeyPackageId: (maxId ?? 0) + 1,
      };
    },

    appendKeyPackages(did: string, keyPackages: Uint8Array[], nowMs: number): number {
      const status = this.getKeyPackagePoolStatus(did);
      if (!status.published) {
        throw new Error("key package pool not published");
      }
      if (keyPackages.length === 0) {
        return status.remainingKeyPackages;
      }

      db.run("BEGIN");
      try {
        const insert = db.prepare(
          `INSERT INTO relay_key_packages (principal_did, key_package, claimed, created_ms)
           VALUES (?, ?, 0, ?)`,
        );
        for (const kp of keyPackages) {
          insert.run(did, kp, nowMs);
        }
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }

      return status.remainingKeyPackages + keyPackages.length;
    },

    fetchKeyPackage(did: string): KeyPackageFetchResult | undefined {
      db.run("BEGIN IMMEDIATE");
      try {
        const remainingBefore =
          db
            .query<{ n: number }, [string]>(
              `SELECT COUNT(*) AS n FROM relay_key_packages WHERE principal_did = ? AND claimed = 0`,
            )
            .get(did)?.n ?? 0;

        if (remainingBefore === 0) return undefined;

        const row = db
          .query<{ id: number; key_package: Uint8Array }, [string]>(
            `SELECT id, key_package FROM relay_key_packages
             WHERE principal_did = ? AND claimed = 0
             ORDER BY id ASC LIMIT 1`,
          )
          .get(did);

        if (row === undefined || row === null) {
          db.run("COMMIT");
          return undefined;
        }

        db.run(`UPDATE relay_key_packages SET claimed = 1 WHERE id = ?`, [row.id]);
        const remainingKeyPackages = remainingBefore - 1;
        db.run("COMMIT");
        return {
          keyPackage: row.key_package,
          remainingKeyPackages,
          keyPackageClaimed: true,
        };
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },

    publishMlsWelcome(input: {
      channelId: string;
      sessionId: string;
      publisherDid: string;
      welcome: Uint8Array;
      route: string;
      nowMs: number;
    }): void {
      db.run(
        `INSERT INTO relay_mls_welcomes (channel_id, session_id, publisher_did, welcome, route, created_ms)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(channel_id, session_id) DO UPDATE SET
           publisher_did = excluded.publisher_did,
           welcome = excluded.welcome,
           route = excluded.route,
           created_ms = excluded.created_ms`,
        [
          input.channelId,
          input.sessionId,
          input.publisherDid,
          input.welcome,
          input.route,
          input.nowMs,
        ],
      );
    },

    fetchMlsWelcome(
      channelId: string,
      sessionId: string,
    ): { welcome: Uint8Array; route: string } | undefined {
      const row = db
        .query<{ welcome: Uint8Array; route: string | null }, [string, string]>(
          `SELECT welcome, route FROM relay_mls_welcomes WHERE channel_id = ? AND session_id = ?`,
        )
        .get(channelId, sessionId);
      if (row === undefined || row === null) return undefined;
      if (row.route === null || row.route.length === 0) return undefined;
      deleteMlsWelcomeStmt.run(channelId, sessionId);
      return { welcome: row.welcome, route: row.route };
    },

    deleteMlsWelcome(channelId: string, sessionId: string): void {
      deleteMlsWelcomeStmt.run(channelId, sessionId);
    },

    purgeExpiredMlsWelcomes(nowMs: number): number {
      const result = db.run(
        `DELETE FROM relay_mls_welcomes
         WHERE channel_id IN (SELECT channel_id FROM channels WHERE expires_at_ms <= ?)`,
        [nowMs],
      );
      return Number(result.changes ?? 0);
    },

    getSessionParties(
      channelId: string,
      sessionId: string,
    ): { partyA: string; partyB: string; initiatorDid: string } | undefined {
      const row = db
        .query<
          { party_a_did: string; party_b_did: string; initiator_did: string | null },
          [string, string]
        >(
          `SELECT party_a_did, party_b_did, initiator_did FROM channel_sessions
           WHERE channel_id = ? AND session_id = ? AND status = 'active'`,
        )
        .get(channelId, sessionId);
      if (row === undefined || row === null) return undefined;
      return {
        partyA: row.party_a_did,
        partyB: row.party_b_did,
        initiatorDid: row.initiator_did ?? row.party_a_did,
      };
    },
  };
}

export type ChannelRegistry = ReturnType<typeof createChannelRegistry>;

export function parseCreateChannelPolicy(body: {
  maxPopulation?: number | undefined;
  maxSessions?: RelaySessionQuota | undefined;
}): {
  admissionMode: RelayAdmissionMode;
  maxPopulation: number | null;
  maxSessions: RelaySessionQuota;
} {
  return {
    admissionMode: "invite_only",
    maxPopulation: body.maxPopulation ?? null,
    maxSessions: body.maxSessions ?? DEFAULT_RELAY_SESSION_QUOTA,
  };
}
