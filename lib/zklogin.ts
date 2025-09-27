// zklogin.ts
// Headless zkLogin helper: no UI, no framework assumptions.

import axios from "axios";
import { fromB64 } from "@mysten/bcs";
import { SuiClient } from "@mysten/sui/client";
import { SerializedSignature } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { TransactionBlock } from "@mysten/sui/transactions";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import {
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
} from "@mysten/zklogin";
import { JwtPayload, jwtDecode } from "jwt-decode";

/** ---- Config (replace with your env) ---- */
export const FULLNODE_URL = "https://fullnode.devnet.sui.io:443";
export const SUI_PROVER_DEV_ENDPOINT = "https://prover-dev.mystenlabs.com/v1";
export const GOOGLE_OAUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID!;
export const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI!;


/** ---- Storage keys (change if you like) ---- */
const KEY_PAIR_SESSION_STORAGE_KEY = "zk_ephemeral_keypair_b64";
const RANDOMNESS_SESSION_STORAGE_KEY = "zk_jwt_randomness";
const USER_SALT_LOCAL_STORAGE_KEY = "zk_user_salt";
const MAX_EPOCH_LOCAL_STORAGE_KEY = "zk_max_epoch";

/** ---- Types ---- */
export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>["0"]["inputs"],
  "addressSeed"
>;

export interface ZkLoginState {
  ephemeralKeyPair?: Ed25519Keypair;
  randomness?: string;
  maxEpoch?: number;
  currentEpoch?: string;
  jwt?: string;
  decoded?: JwtPayload;
  userSalt?: string;
  zkAddress?: string;
  extendedEphemeralPublicKey?: string;
  partialProof?: PartialZkLoginSignature;
}

export class ZkLogin {
  readonly sui: SuiClient;
  state: ZkLoginState = {};

  constructor(nodeUrl = FULLNODE_URL) {
    this.sui = new SuiClient({ url: nodeUrl });
    // load persisted pieces (optional)
    this._loadFromStorage();
  }

  /** -------- Ephemeral key -------- */
  createEphemeral(): Ed25519Keypair {
    const kp = Ed25519Keypair.generate();
    sessionStorage.setItem(
      KEY_PAIR_SESSION_STORAGE_KEY,
      kp.export().privateKey
    );
    this.state.ephemeralKeyPair = kp;
    return kp;
  }

  clearEphemeral() {
    sessionStorage.removeItem(KEY_PAIR_SESSION_STORAGE_KEY);
    this.state.ephemeralKeyPair = undefined;
  }

  /** -------- Epochs & randomness -------- */
  async loadEpochAndSetMax(offset = 10): Promise<{ epoch: string; max: number }> {
    const { epoch } = await this.sui.getLatestSuiSystemState();
    const max = Number(epoch) + offset;
    localStorage.setItem(MAX_EPOCH_LOCAL_STORAGE_KEY, String(max));
    this.state.currentEpoch = epoch;
    this.state.maxEpoch = max;
    return { epoch, max };
  }

  generateRandomness(): string {
    const r = generateRandomness();
    sessionStorage.setItem(RANDOMNESS_SESSION_STORAGE_KEY, r);
    this.state.randomness = r;
    return r;
  }

  /** -------- Nonce & OAuth redirect -------- */
  getNonce(): string {
    if (!this.state.ephemeralKeyPair || !this.state.maxEpoch || !this.state.randomness) {
      throw new Error("Missing ephemeralKeyPair, maxEpoch, or randomness");
    }
    return generateNonce(
      this.state.ephemeralKeyPair.getPublicKey(),
      this.state.maxEpoch,
      this.state.randomness
    );
  }

  buildGoogleOAuthURL(nonce: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "id_token",
      scope: "openid",
      nonce,
    });
    return `${GOOGLE_OAUTH_URL}?${params}`;
  }

  /** -------- JWT handling -------- */
  setJwt(idToken: string) {
    const decoded = jwtDecode(idToken) as JwtPayload;
    this.state.jwt = idToken;
    this.state.decoded = decoded;
  }

  /** -------- User salt management -------- */
  ensureUserSalt(): string {
    let salt = localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY) || "";
    if (!salt) {
      salt = generateRandomness();
      localStorage.setItem(USER_SALT_LOCAL_STORAGE_KEY, salt);
    }
    this.state.userSalt = salt;
    return salt;
  }

  setUserSalt(salt: string) {
    localStorage.setItem(USER_SALT_LOCAL_STORAGE_KEY, salt);
    this.state.userSalt = salt;
  }

  clearUserSalt() {
    localStorage.removeItem(USER_SALT_LOCAL_STORAGE_KEY);
    this.state.userSalt = undefined;
  }

  /** -------- Derive zkLogin Sui address -------- */
  deriveZkAddress(): string {
    if (!this.state.jwt || !this.state.userSalt) {
      throw new Error("Missing jwt or userSalt");
    }
    const addr = jwtToAddress(this.state.jwt, this.state.userSalt);
    this.state.zkAddress = addr;
    return addr;
  }

  /** -------- Extended ephemeral public key -------- */
  computeExtendedEphemeralPublicKey(): string {
    if (!this.state.ephemeralKeyPair) throw new Error("Missing ephemeralKeyPair");
    const ext = getExtendedEphemeralPublicKey(this.state.ephemeralKeyPair.getPublicKey());
    this.state.extendedEphemeralPublicKey = ext;
    return ext;
  }

  /** -------- Fetch ZK proof (partial signature inputs) -------- */
  async fetchZkProof(keyClaimName: "sub" | "email" = "sub"): Promise<PartialZkLoginSignature> {
    const { jwt, extendedEphemeralPublicKey, maxEpoch, randomness, userSalt } = this.state;
    if (!jwt || !extendedEphemeralPublicKey || !maxEpoch || !randomness || !userSalt) {
      throw new Error("Missing jwt / extendedEphemeralPublicKey / maxEpoch / randomness / userSalt");
    }

    const res = await axios.post(
      SUI_PROVER_DEV_ENDPOINT,
      {
        jwt,
        extendedEphemeralPublicKey,
        maxEpoch,
        jwtRandomness: randomness,
        salt: userSalt,
        keyClaimName,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const partial = res.data as PartialZkLoginSignature;
    this.state.partialProof = partial;
    return partial;
  }

  /** -------- Build & execute zkLogin transaction -------- */
  async executeSimpleTransfer(
    to: string,
    amountSui = 1n
  ): Promise<{ digest: string }> {
    const { ephemeralKeyPair, partialProof, decoded, userSalt, maxEpoch, zkAddress } = this.state;
    if (!ephemeralKeyPair || !partialProof || !decoded || !userSalt || !maxEpoch || !zkAddress) {
      throw new Error("Missing execution prerequisites");
    }
    if (!decoded.sub || !decoded.aud) throw new Error("JWT missing sub or aud");

    const txb = new TransactionBlock();
    const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI * amountSui]);
    txb.transferObjects([coin], to);
    txb.setSender(zkAddress);

    const { bytes, signature: userSignature } = await txb.sign({
      client: this.sui,
      signer: ephemeralKeyPair,
    });

    const addressSeed = genAddressSeed(
      BigInt(userSalt),
      "sub",
      decoded.sub,
      decoded.aud as string
    ).toString();

    const zkLoginSignature: SerializedSignature = getZkLoginSignature({
      inputs: { ...partialProof, addressSeed },
      maxEpoch,
      userSignature,
    });

    const exec = await this.sui.executeTransactionBlock({
      transactionBlock: bytes,
      signature: zkLoginSignature,
    });

    return { digest: exec.digest };
  }

  /** -------- Utilities -------- */
  getBalanceQueryArgs(owner: string) {
    return { owner };
  }

  /** -------- Reset everything (careful: clears local/session storage) -------- */
  hardReset() {
    sessionStorage.removeItem(KEY_PAIR_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(RANDOMNESS_SESSION_STORAGE_KEY);
    localStorage.removeItem(USER_SALT_LOCAL_STORAGE_KEY);
    localStorage.removeItem(MAX_EPOCH_LOCAL_STORAGE_KEY);
    this.state = {};
  }

  /** -------- Internal: load persisted state -------- */
  private _loadFromStorage() {
    const pk = sessionStorage.getItem(KEY_PAIR_SESSION_STORAGE_KEY);
    if (pk) this.state.ephemeralKeyPair = Ed25519Keypair.fromSecretKey(fromB64(pk));
    const r = sessionStorage.getItem(RANDOMNESS_SESSION_STORAGE_KEY);
    if (r) this.state.randomness = r;
    const salt = localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY);
    if (salt) this.state.userSalt = salt;
    const me = localStorage.getItem(MAX_EPOCH_LOCAL_STORAGE_KEY);
    if (me) this.state.maxEpoch = Number(me);
  }
}
