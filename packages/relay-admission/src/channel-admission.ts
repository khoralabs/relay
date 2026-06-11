/** Active channel admission row used to mint and verify HMAC join tickets. */
export type ChannelAdmissionRecord = {
  channelId: string;
  pairingSecretHex: string;
  createdAtMs: number;
  expiresAtMs: number;
};

/** Persistence port for channel admission records. Implementations are integrator-specific. */
export type ChannelAdmissionStore = {
  upsertChannelAdmission(record: ChannelAdmissionRecord): void;
  getChannelAdmissionIfActive(channelId: string, nowMs: number): ChannelAdmissionRecord | undefined;
  purgeExpiredChannels(nowMs: number): number;
  purgeChannel(channelId: string): void;
};
