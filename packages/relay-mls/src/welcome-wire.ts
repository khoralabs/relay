import { decodeWelcome, encodeWelcome, type Welcome } from "ts-mls/welcome.js";

export function encodeWelcomeWire(welcome: Welcome): Uint8Array {
  return encodeWelcome(welcome);
}

export function decodeWelcomeWire(bytes: Uint8Array): Welcome {
  const decoded = decodeWelcome(bytes, 0);
  if (decoded === undefined) {
    throw new Error("failed to decode Welcome wire bytes");
  }
  return decoded[0];
}
