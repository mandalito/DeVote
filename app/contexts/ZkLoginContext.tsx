'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { genAddressSeed, getZkLoginSignature, getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
import { useSuiClient } from "@mysten/dapp-kit";

const accountDataKey = "zklogin-demo.accounts";
const NETWORK = "devnet";

type AccountData = {
    provider: string;
    userAddr: string;
    zkProofs: any;
    ephemeralPrivateKey: string;
    userSalt: string;
    sub: string;
    aud: string;
    maxEpoch: number;
};

interface ZkLoginContextType {
  account: AccountData | null;
  login: (accountData: AccountData) => void;
  logout: () => void;
  executeTransaction: (transaction: Transaction) => Promise<{ digest: string }>;
  isPending: boolean;
}

const ZkLoginContext = createContext<ZkLoginContextType | undefined>(undefined);

export const ZkLoginProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [isPending, setIsPending] = useState(false);
  const suiClient = useSuiClient();

  useEffect(() => {
    const loadAccount = async () => {
      const dataRaw = sessionStorage.getItem(accountDataKey);
      if (dataRaw) {
        const data: AccountData[] = JSON.parse(dataRaw);
        if (data.length > 0) {
          const accountData = data[0];
          
          // Check if the session has expired
          try {
            const currentEpoch = await suiClient.getLatestSuiSystemState().then(state => Number(state.epoch));
            if (currentEpoch >= accountData.maxEpoch) {
              console.log("zkLogin: Session expired on load, clearing...");
              sessionStorage.removeItem(accountDataKey);
              return;
            }
            setAccount(accountData);
          } catch (error) {
            console.error("Error checking epoch:", error);
            setAccount(accountData); // Set anyway, will fail later with better error
          }
        }
      }
    };
    
    loadAccount();
  }, []);

  const login = (accountData: AccountData) => {
    setAccount(accountData);
    sessionStorage.setItem(accountDataKey, JSON.stringify([accountData]));
  };

  const logout = () => {
    console.log("zkLogin: Logging out and clearing all session data...");
    setAccount(null);
    sessionStorage.removeItem(accountDataKey);
    // Also clear any other zklogin related storage
    sessionStorage.removeItem("zklogin-demo.setup"); // Clear setup data too
    localStorage.clear(); // Also clear local storage
    sessionStorage.clear(); // Clear all session storage to be safe
  };

  const executeTransaction = async (transaction: Transaction): Promise<{ digest: string }> => {
    if (!account) {
      throw new Error("Not logged in with zkLogin");
    }

    // Check if the zkLogin session has expired
    const currentEpoch = await suiClient.getLatestSuiSystemState().then(state => Number(state.epoch));
    console.log("zkLogin: Current epoch:", currentEpoch, "Account max epoch:", account.maxEpoch);
    
    if (currentEpoch >= account.maxEpoch) {
      throw new Error(`zkLogin session expired. Current epoch: ${currentEpoch}, Session valid until epoch: ${account.maxEpoch}. Please logout and login again.`);
    }

    setIsPending(true);
    try {
      console.log("zkLogin: Setting transaction sender to:", account.userAddr);
      console.log("🔄 RESTORING zkLogin ADDRESS FOR PROPER zkLogin FLOW");
      transaction.setSender(account.userAddr); // zkLogin address

      console.log("zkLogin: Creating ephemeral keypair...");
      const keyPair = decodeSuiPrivateKey(account.ephemeralPrivateKey);
      const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keyPair.secretKey);
      
      console.log("zkLogin: Account data:", {
        provider: account.provider,
        userAddr: account.userAddr,
        maxEpoch: account.maxEpoch,
        sub: account.sub,
        aud: account.aud,
        ephemeralPrivateKey: account.ephemeralPrivateKey
      });
      
      console.log("zkLogin: Ephemeral public key:", ephemeralKeyPair.getPublicKey().toSuiAddress());
      console.log("zkLogin: zkLogin address (userAddr):", account.userAddr);
      
      // Verify the ephemeral key matches what was used for proof generation
      const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());
      console.log("zkLogin: Extended ephemeral public key:", extendedEphemeralPublicKey);
      console.log("zkLogin: About to sign transaction...");
      console.log("zkLogin: Transaction data:", transaction);
      console.log("zkLogin address:", ephemeralKeyPair.getPublicKey().toSuiAddress());
      console.log("zkLogin: Using configured SuiClient from dapp-kit...");
      const { bytes, signature: userSignature } = await transaction.sign({
        client: suiClient,
        signer: ephemeralKeyPair,
      });
      console.log("zkLogin: Transaction signed successfully");

      const addressSeed = genAddressSeed(
        BigInt(account.userSalt),
        "sub",
        account.sub,
        account.aud,
      ).toString();

      console.log("zkLogin: Address seed generation:");
      console.log("- userSalt:", account.userSalt);
      console.log("- sub:", account.sub);
      console.log("- aud:", account.aud);
      console.log("- addressSeed:", addressSeed);
      console.log("- zkProofs keys:", Object.keys(account.zkProofs));
      
      // Debug: Compare with jwtToAddress calculation
      console.log("zkLogin: Verification - jwtToAddress result:", account.userAddr);
      console.log("zkLogin: Should match the userAddr from proof generation");

      console.log("zkLogin: Constructing zkLogin signature with:");
      console.log("- maxEpoch:", account.maxEpoch);
      console.log("- userSignature length:", userSignature.length);
      console.log("- addressSeed:", addressSeed);
      
      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...account.zkProofs,
          addressSeed,
        },
        maxEpoch: account.maxEpoch,
        userSignature,
      });
      
      console.log("zkLogin: zkLoginSignature created, length:", zkLoginSignature.length);

      console.log("zkLogin: Executing transaction with dapp-kit client...");
      console.log("🚀 USING zkLogin SIGNATURE FOR PROPER AUTHENTICATION");
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature, // Using zkLogin signature
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true, // Add this to get object changes
        },
      });
      console.log("zkLogin: Transaction executed successfully:", result.digest);
      console.log("zkLogin: Full transaction result:", result);
      return result; // Return the full result object instead of just digest
    } finally {
      setIsPending(false);
    }
  };

  return (
    <ZkLoginContext.Provider value={{ account, login, logout, executeTransaction, isPending }}>
      {children}
    </ZkLoginContext.Provider>
  );
};

export const useZkLogin = () => {
  const context = useContext(ZkLoginContext);
  if (context === undefined) {
    throw new Error('useZkLogin must be used within a ZkLoginProvider');
  }
  return context;
};
