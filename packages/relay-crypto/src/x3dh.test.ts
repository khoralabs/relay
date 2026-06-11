import { expect, test } from "bun:test";
import { getPublicKeyAsync } from "@noble/ed25519";

import { bytesToHex } from "./encoding";
import {
  buildX3dhInitiator,
  deriveX3dhResponder,
  generateSignedPreKey,
  verifySignedPreKey,
} from "./x3dh";

test("X3DH initiator and responder derive same SK", async () => {
  const seedA = crypto.getRandomValues(new Uint8Array(32));
  const seedB = crypto.getRandomValues(new Uint8Array(32));
  const ikA = await getPublicKeyAsync(seedA);
  const ikB = await getPublicKeyAsync(seedB);

  const { bundle: spkB, priv: spkPrivB } = await generateSignedPreKey(seedB, 1);
  const peerBundle = {
    did: "did:key:peer",
    identityKey: bytesToHex(ikB),
    signedPreKey: spkB,
    oneTimePreKey: undefined,
  };
  expect(await verifySignedPreKey(peerBundle)).toBe(true);

  const { sk: skA, initMessage } = await buildX3dhInitiator({
    myIdentityPriv: seedA,
    peerBundle,
  });
  const skB = await deriveX3dhResponder({
    myIdentityPriv: seedB,
    mySpkPriv: spkPrivB,
    initMessage,
    peerIdentityKey: bytesToHex(ikA),
  });

  expect(bytesToHex(skA)).toBe(bytesToHex(skB));
});
