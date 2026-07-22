import { describe, expect, test } from "bun:test";
import { base58Encode } from "@khoralabs/relay/crypto";
import { encodeKeyPackageWire } from "./key-package-wire";
import { MlsGroupSession } from "./mls-group-session";
import { getRelayMlsCiphersuite } from "./relay-mls-ciphersuite";
import { generateDidBoundKeyPackage } from "./relay-mls-key-package";

function didKeyFromPublicKey(pubKey: Uint8Array): string {
  const prefixed = new Uint8Array(2 + pubKey.length);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(pubKey, 2);
  return `did:key:z${base58Encode(prefixed)}`;
}

async function testAgent() {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  const { getPublicKeyAsync } = await import("@noble/ed25519");
  const publicKey = await getPublicKeyAsync(privateKey);
  const did = didKeyFromPublicKey(publicKey);
  return { did, privateKey, publicKey };
}

describe("MlsGroupSession", () => {
  test("two-party MLS round-trip with DID-bound KeyPackages", async () => {
    const cs = await getRelayMlsCiphersuite();
    const alice = await testAgent();
    const bob = await testAgent();

    const bobKp = await generateDidBoundKeyPackage(bob.did, bob.privateKey, cs);
    const aliceSession = new MlsGroupSession("session-1", alice.did, alice.privateKey);
    const { welcomeBase64Url } = await aliceSession.createWithPeer(
      encodeKeyPackageWire(bobKp.publicPackage),
      bob.did,
    );

    const bobSession = new MlsGroupSession("session-1", bob.did, bob.privateKey);
    const { base64UrlToBytes } = await import("@khoralabs/relay/crypto");
    await bobSession.joinFromWelcome(
      base64UrlToBytes(welcomeBase64Url),
      bobKp.privatePackage,
      bobKp.publicPackage,
    );

    const plaintext = new TextEncoder().encode("obp-payload");
    const mlsBytes = await aliceSession.encryptApplication(plaintext);
    const decrypted = await bobSession.processInboundMessage(mlsBytes);
    if (decrypted === undefined) throw new Error("expected application plaintext");
    expect(new TextDecoder().decode(decrypted)).toBe("obp-payload");
  });

  test("processes inbound rekey commit and continues application traffic", async () => {
    const cs = await getRelayMlsCiphersuite();
    const alice = await testAgent();
    const bob = await testAgent();

    const bobKp = await generateDidBoundKeyPackage(bob.did, bob.privateKey, cs);
    const aliceSession = new MlsGroupSession("session-rekey", alice.did, alice.privateKey);
    const { welcomeBase64Url } = await aliceSession.createWithPeer(
      encodeKeyPackageWire(bobKp.publicPackage),
      bob.did,
    );

    const bobSession = new MlsGroupSession("session-rekey", bob.did, bob.privateKey);
    const { base64UrlToBytes } = await import("@khoralabs/relay/crypto");
    await bobSession.joinFromWelcome(
      base64UrlToBytes(welcomeBase64Url),
      bobKp.privatePackage,
      bobKp.publicPackage,
    );

    const rekeyMsg = await aliceSession.createSelfRekeyMessage();
    expect(await bobSession.processInboundMessage(rekeyMsg)).toBeUndefined();

    const plaintext = new TextEncoder().encode("after-rekey");
    const mlsBytes = await aliceSession.encryptApplication(plaintext);
    const decrypted = await bobSession.processInboundMessage(mlsBytes);
    expect(decrypted).toEqual(plaintext);
  });

  test("rejects peer KeyPackage when credential DID does not match", async () => {
    const cs = await getRelayMlsCiphersuite();
    const alice = await testAgent();
    const bob = await testAgent();
    const bobKp = await generateDidBoundKeyPackage(bob.did, bob.privateKey, cs);
    const aliceSession = new MlsGroupSession("session-1", alice.did, alice.privateKey);
    await expect(
      aliceSession.createWithPeer(encodeKeyPackageWire(bobKp.publicPackage), alice.did),
    ).rejects.toThrow(/DID mismatch/);
  });
});
