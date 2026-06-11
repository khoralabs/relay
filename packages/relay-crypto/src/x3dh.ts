import { ed25519, x25519 } from "@noble/curves/ed25519.js";

import { bytesToHex, hexToBytes } from "./encoding";
import type { PreKeyBundle, SignedPreKey, X3dhInitMessage } from "./prekeys";

function ed25519SeedToX25519Priv(seed: Uint8Array): Uint8Array {
  return ed25519.utils.toMontgomerySecret(seed);
}

function ed25519PubHexToX25519Pub(hex: string): Uint8Array {
  const edPub = hexToBytes(hex);
  return ed25519.utils.toMontgomery(edPub);
}

function x25519PubToHex(pub: Uint8Array): string {
  return bytesToHex(pub);
}

function concatDh(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function deriveSk(dhInputs: Uint8Array[]): Promise<Uint8Array> {
  const material = concatDh(...dhInputs);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    material.buffer.slice(
      material.byteOffset,
      material.byteOffset + material.byteLength,
    ) as ArrayBuffer,
  );
  return new Uint8Array(hash);
}

/** Generate a signed prekey (X25519 keypair; SPK.sig = Ed25519Sign(identityPriv, spkPub)). */
export async function generateSignedPreKey(
  identityPriv: Uint8Array,
  keyId: number,
): Promise<{ bundle: SignedPreKey; priv: Uint8Array }> {
  const priv = x25519.utils.randomSecretKey();
  const pub = x25519.getPublicKey(priv);
  const sig = ed25519.sign(pub, identityPriv);
  return {
    bundle: {
      keyId,
      publicKey: x25519PubToHex(pub),
      signature: bytesToHex(sig),
    },
    priv,
  };
}

/** Generate one-time prekeys (X25519 keypairs). */
export function generateOneTimePreKeys(
  count: number,
  startId = 1,
): Array<{ bundle: { keyId: number; publicKey: string }; priv: Uint8Array }> {
  const out: Array<{ bundle: { keyId: number; publicKey: string }; priv: Uint8Array }> = [];
  for (let i = 0; i < count; i++) {
    const priv = x25519.utils.randomSecretKey();
    const pub = x25519.getPublicKey(priv);
    out.push({
      bundle: { keyId: startId + i, publicKey: x25519PubToHex(pub) },
      priv,
    });
  }
  return out;
}

/** Verify SPK signature using identity key from bundle. */
export async function verifySignedPreKey(bundle: PreKeyBundle): Promise<boolean> {
  const ikPub = hexToBytes(bundle.identityKey);
  const spkPub = hexToBytes(bundle.signedPreKey.publicKey);
  const sig = hexToBytes(bundle.signedPreKey.signature);
  return ed25519.verify(sig, spkPub, ikPub);
}

/** X3DH initiator: computes SK + produces X3dhInitMessage to embed in genesis turn. */
export async function buildX3dhInitiator(opts: {
  myIdentityPriv: Uint8Array;
  peerBundle: PreKeyBundle;
}): Promise<{ sk: Uint8Array; ek: Uint8Array; initMessage: X3dhInitMessage }> {
  const ikA_x = ed25519SeedToX25519Priv(opts.myIdentityPriv);
  const ikB_x = ed25519PubHexToX25519Pub(opts.peerBundle.identityKey);
  const spkB = hexToBytes(opts.peerBundle.signedPreKey.publicKey);
  const ekPriv = x25519.utils.randomSecretKey();
  const ekPub = x25519.getPublicKey(ekPriv);

  const dh: Uint8Array[] = [
    x25519.getSharedSecret(ikA_x, spkB),
    x25519.getSharedSecret(ekPriv, ikB_x),
    x25519.getSharedSecret(ekPriv, spkB),
  ];

  let opkId: number | null = null;
  if (opts.peerBundle.oneTimePreKey !== undefined) {
    const opkB = hexToBytes(opts.peerBundle.oneTimePreKey.publicKey);
    dh.push(x25519.getSharedSecret(ekPriv, opkB));
    opkId = opts.peerBundle.oneTimePreKey.keyId;
  }

  const sk = await deriveSk(dh);
  return {
    sk,
    ek: ekPub,
    initMessage: { ek: x25519PubToHex(ekPub), opkId },
  };
}

/** X3DH responder: derives same SK given own private keys + initiator's message. */
export async function deriveX3dhResponder(opts: {
  myIdentityPriv: Uint8Array;
  mySpkPriv: Uint8Array;
  myOtkPriv?: Uint8Array;
  initMessage: X3dhInitMessage;
  peerIdentityKey: string;
}): Promise<Uint8Array> {
  const ikA_x = ed25519PubHexToX25519Pub(opts.peerIdentityKey);
  const ikB_x = ed25519SeedToX25519Priv(opts.myIdentityPriv);
  const _spkB = x25519.getPublicKey(opts.mySpkPriv);
  const ekA = hexToBytes(opts.initMessage.ek);

  const dh: Uint8Array[] = [
    x25519.getSharedSecret(opts.mySpkPriv, ikA_x),
    x25519.getSharedSecret(ikB_x, ekA),
    x25519.getSharedSecret(opts.mySpkPriv, ekA),
  ];

  if (opts.myOtkPriv !== undefined) {
    dh.push(x25519.getSharedSecret(opts.myOtkPriv, ekA));
  }

  return deriveSk(dh);
}
