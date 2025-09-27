import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64, toB64 } from '@mysten/sui.js/utils';

const EPHEMERAL_KEY_KEY = 'ephemeral_key_b64';
const EPHEMERAL_KEY_EXP = 'ephemeral_key_exp';

export function getOrCreateEphemeralKey(ttlMs = 10 * 60 * 1000): Ed25519Keypair {
  if (typeof window === 'undefined') throw new Error('Browser only');

  const now = Date.now();
  const existing = window.sessionStorage.getItem(EPHEMERAL_KEY_KEY);
  const exp = window.sessionStorage.getItem(EPHEMERAL_KEY_EXP);

  if (existing && exp && Number(exp) > now) {
    const secretKey = fromB64(existing);
    return Ed25519Keypair.fromSecretKey(secretKey.slice(1)); // slice(1) to remove flag if present
  }
  const kp = Ed25519Keypair.generate();
  const sk = kp.export().privateKey; // base64 string
  window.sessionStorage.setItem(EPHEMERAL_KEY_KEY, sk);
  window.sessionStorage.setItem(EPHEMERAL_KEY_EXP, String(now + ttlMs));
  return kp;
}

export function clearEphemeralKey() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(EPHEMERAL_KEY_KEY);
  window.sessionStorage.removeItem(EPHEMERAL_KEY_EXP);
}

export function getEphemeralPublicKeyB64(): string {
  const kp = getOrCreateEphemeralKey();
  return toB64(kp.getPublicKey().toRawBytes());
}
