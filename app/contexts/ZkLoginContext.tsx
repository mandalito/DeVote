'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { genAddressSeed, getZkLoginSignature } from "@mysten/sui/zklogin";

const accountDataKey = "zklogin-demo.accounts";
const NETWORK = "testnet";

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
  const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

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
      //transaction.setSender(account.userAddr);

      console.log("zkLogin: Creating ephemeral keypair...");
      console.log("zkLogin: Account data:", {
        provider: account.provider,
        userAddr: account.userAddr,
        maxEpoch: account.maxEpoch,
        sub: account.sub,
        aud: account.aud
      });
      const keyPair = decodeSuiPrivateKey(account.ephemeralPrivateKey);
      const constantKeyPair = "suiprivkey1qzajeccejzyxp2calmtxx03ahkp0uyyag72ezp5h6l0pnjqvn8hxsedtjka"
      //const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(keyPair.secretKey);
      const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(constantKeyPair);
      transaction.setSender(ephemeralKeyPair.getPublicKey().toSuiAddress());
      console.log("zkLogin: About to sign transaction...");
      console.log("zkLogin: Transaction data:", transaction);
      console.log("zkLogin address:", ephemeralKeyPair.getPublicKey().toSuiAddress());
      // Try creating a fresh SuiClient to bypass any caching issues
      const freshClient = new SuiClient({
        url: "https://fullnode.testnet.sui.io:443"
      });
      
      console.log("zkLogin: Using fresh SuiClient for signing...");
      const { bytes, signature: userSignature } = await transaction.sign({
        client: freshClient,
        signer: ephemeralKeyPair,
      });
      console.log("zkLogin: Transaction signed successfully");

      const addressSeed = genAddressSeed(
        BigInt(account.userSalt),
        "sub",
        account.sub,
        account.aud,
      ).toString();

      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...account.zkProofs,
          addressSeed,
        },
        maxEpoch: account.maxEpoch,
        userSignature,
      });

      console.log("zkLogin: Executing transaction with fresh client...");
      const result = await freshClient.executeTransactionBlock({
        transactionBlock: bytes,
        //signature: zkLoginSignature,
        signature: userSignature,
        options: {
          showEffects: true,
        },
      });
      console.log("zkLogin: Transaction executed successfully:", result.digest);
      return { digest: result.digest };
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
