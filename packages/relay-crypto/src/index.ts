export { ed25519PublicKeyBytesFromDid } from "./did";
export {
  base58Decode,
  base58Encode,
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  hexToBytes,
} from "./encoding";
export {
  decryptPairingSecretHex,
  encryptPairingSecretHex,
  isEncryptedPairingSecret,
  PAIRING_SECRET_ENVELOPE_ALG,
  PAIRING_SECRET_ENVELOPE_MAGIC,
  PAIRING_SECRET_ENVELOPE_V1,
  RelayCryptoError,
} from "./pairing-secret-cipher";
export {
  PAIRING_SECRET_ENCRYPTION_KEY_ENV,
  PAIRING_SECRET_KDF_INFO,
  PAIRING_SECRET_KDF_SALT,
  pairingSecretKeyFromBase64Url,
  pairingSecretKeyFromEnv,
  pairingSecretKeyFromHex,
  pairingSecretKeyFromPassphrase,
  pairingSecretKeyFromUtf8,
  TEST_PAIRING_SECRET_KEY_HEX,
} from "./pairing-secret-key";
export type {
  OneTimePreKey,
  PreKeyBundle,
  PublishPreKeyBundleBody,
  SignedPreKey,
  X3dhInitMessage,
} from "./prekeys";
export {
  parsePreKeyBundle,
  parsePublishPreKeyBundleBody,
  parseX3dhInitMessage,
} from "./prekeys";
export type { PersistableRelaySigner, RelaySigner } from "./signer";
export {
  buildX3dhInitiator,
  deriveX3dhResponder,
  generateOneTimePreKeys,
  generateSignedPreKey,
  verifySignedPreKey,
} from "./x3dh";
