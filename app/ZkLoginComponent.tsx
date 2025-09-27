'use client';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import {
    genAddressSeed,
    generateNonce,
    generateRandomness,
    getExtendedEphemeralPublicKey,
    getZkLoginSignature,
    jwtToAddress,
} from "@mysten/sui/zklogin";
import { NetworkName, makePolymediaUrl, requestSuiFromFaucet, shortenAddress } from "@polymedia/suitcase-core";
import { isLocalhost } from "@polymedia/suitcase-react";
import { jwtDecode } from "jwt-decode";
import { useEffect, useRef, useState } from "react";
import { useZkLogin } from "@/app/contexts/ZkLoginContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* Configuration */

import config from "../config.json"; 

const NETWORK: NetworkName = "devnet";
const MAX_EPOCH = 2; // keep ephemeral keys active for this many Sui epochs from now (1 epoch ~= 24h)

const suiClient = new SuiClient({
    url: getFullnodeUrl(NETWORK),
});

/* Session storage keys */

const setupDataKey = "zklogin-demo.setup";
const accountDataKey = "zklogin-demo.accounts";

/* Types */

type OpenIdProvider = "Google" | "Twitch" | "Facebook";

type SetupData = {
    provider: OpenIdProvider;
    maxEpoch: number;
    randomness: string;
    ephemeralPrivateKey: string;
};

type AccountData = {
    provider: OpenIdProvider;
    userAddr: string;
    zkProofs: any;
    ephemeralPrivateKey: string;
    userSalt: string;
    sub: string;
    aud: string;
    maxEpoch: number;
};

export default function ZkLoginComponent()
{
    const { login } = useZkLogin();
    const router = useRouter();
    const accounts = useRef<AccountData[]>(loadAccounts()); 
    const [balances, setBalances] = useState<Map<string, number>>(new Map()); 
    const [modalContent, setModalContent] = useState<string | null>(null);

    useEffect(() => {
        completeZkLogin();
        fetchBalances(accounts.current);
        const interval = setInterval(() => fetchBalances(accounts.current), 5_000);
        return () => {clearInterval(interval);};
    }, []);

    async function beginZkLogin(provider: OpenIdProvider)
    {
        setModalContent(`🔑 Logging in with ${provider}...`);

        const { epoch } = await suiClient.getLatestSuiSystemState();
        const maxEpoch = Number(epoch) + MAX_EPOCH;
        const ephemeralKeyPair = new Ed25519Keypair();
        const randomness = generateRandomness();
        const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

        saveSetupData({
            provider,
            maxEpoch,
            randomness: randomness.toString(),
            ephemeralPrivateKey: ephemeralKeyPair.getSecretKey(),
        });

        const urlParamsBase = {
            nonce: nonce,
            redirect_uri: `${window.location.origin}/auth`,
            response_type: "id_token",
            scope: "openid",
        };
        let loginUrl: string;
        switch (provider) {
            case "Google": {
                const urlParams = new URLSearchParams({
                    ...urlParamsBase,
                    client_id: config.CLIENT_ID_GOOGLE,
                });
                loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${urlParams.toString()}`;
                break;
            }
            case "Twitch": {
                const urlParams = new URLSearchParams({
                    ...urlParamsBase,
                    client_id: config.CLIENT_ID_TWITCH,
                });
                loginUrl = `https://id.twitch.tv/oauth2/authorize?${urlParams.toString()}`;
                break;
            }
            case "Facebook": {
                const urlParams = new URLSearchParams({
                    ...urlParamsBase,
                    client_id: config.CLIENT_ID_FACEBOOK,
                });
                loginUrl = `https://www.facebook.com/v19.0/dialog/oauth?${urlParams.toString()}`;
                break;
            }
        }
        window.location.replace(loginUrl);
    }

    async function completeZkLogin()
    {
        const urlFragment = window.location.hash.substring(1);
        const urlParams = new URLSearchParams(urlFragment);
        const jwt = urlParams.get("id_token");
        if (!jwt) {
            return;
        }

        window.history.replaceState(null, "", window.location.pathname);

        const jwtPayload = jwtDecode(jwt);
        if (!jwtPayload.sub || !jwtPayload.aud) {
            console.warn("[completeZkLogin] missing jwt.sub or jwt.aud");
            return;
        }

        const requestOptions =
            config.URL_SALT_SERVICE === "/dummy-salt-service.json"
            ?
            {
                method: "GET",
            }
            :
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jwt }),
            };

        const saltResponse: { salt: string } | null =
            await fetch(config.URL_SALT_SERVICE, requestOptions)
            .then(res => {
                console.debug("[completeZkLogin] salt service success");
                return res.json();
            })
            .catch((error: unknown) => {
                console.warn("[completeZkLogin] salt service error:", error);
                return null;
            });

        if (!saltResponse) {
            return;
        }

        const userSalt = BigInt(saltResponse.salt);

        const userAddr = jwtToAddress(jwt, userSalt);

        const setupData = loadSetupData();
        if (!setupData) {
            console.warn("[completeZkLogin] missing session storage data");
            return;
        }
        clearSetupData();
        for (const account of accounts.current) {
            if (userAddr === account.userAddr) {
                console.warn(`[completeZkLogin] already logged in with this ${setupData.provider} account`);
                return;
            }
        }

        const ephemeralKeyPair = keypairFromSecretKey(setupData.ephemeralPrivateKey);
        const ephemeralPublicKey = ephemeralKeyPair.getPublicKey();
        const payload = JSON.stringify({
            maxEpoch: setupData.maxEpoch,
            jwtRandomness: setupData.randomness,
            extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(ephemeralPublicKey),
            jwt,
            salt: userSalt.toString(),
            keyClaimName: "sub",
        }, null, 2);

        console.debug("[completeZkLogin] Requesting ZK proof with:", payload);
        setModalContent("⏳ Requesting ZK proof. This can take a few seconds...");

        const zkProofs = await fetch(config.URL_ZK_PROVER, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        })
        .then(res => {
            console.debug("[completeZkLogin] ZK proving service success");
            return res.json();
        })
        .catch((error: unknown) => {
            console.warn("[completeZkLogin] ZK proving service error:", error);
            return null;
        })
        .finally(() => {
            setModalContent(null);
        });

        if (!zkProofs) {
            return;
        }

        const account = {
            provider: setupData.provider,
            userAddr,
            zkProofs,
            ephemeralPrivateKey: setupData.ephemeralPrivateKey,
            userSalt: userSalt.toString(),
            sub: jwtPayload.sub,
            aud: typeof jwtPayload.aud === "string" ? jwtPayload.aud : jwtPayload.aud[0],
            maxEpoch: setupData.maxEpoch,
        };

        login(account);
        saveAccount(account);
        router.push('/');
    }

    async function sendTransaction(account: AccountData) {
        setModalContent("🚀 Sending transaction...");

        const tx = new Transaction();
        tx.setSender(account.userAddr);

        const ephemeralKeyPair = keypairFromSecretKey(account.ephemeralPrivateKey);
        const { bytes, signature: userSignature } = await tx.sign({
            client: suiClient,
            signer: ephemeralKeyPair,
        });

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

        await suiClient.executeTransactionBlock({
            transactionBlock: bytes,
            signature: zkLoginSignature,
            options: {
                showEffects: true,
            },
        })
        .then(result => {
            console.debug("[sendTransaction] executeTransactionBlock response:", result);
            fetchBalances([account]);
        })
        .catch((error: unknown) => {
            console.warn("[sendTransaction] executeTransactionBlock failed:", error);
            return null;
        })
        .finally(() => {
            setModalContent(null);
        });
    }

    function keypairFromSecretKey(privateKeyBase64: string): Ed25519Keypair {
        const keyPair = decodeSuiPrivateKey(privateKeyBase64);
        return Ed25519Keypair.fromSecretKey(keyPair.secretKey);
    }

    async function fetchBalances(accounts: AccountData[]) {
        if (accounts.length == 0) {
            return;
        }
        const newBalances = new Map<string, number>();
        for (const account of accounts) {
            const suiBalance = await suiClient.getBalance({
                owner: account.userAddr,
                coinType: "0x2::sui::SUI",
            });
            newBalances.set(
                account.userAddr,
                +suiBalance.totalBalance/1_000_000_000
            );
        }
        setBalances(prevBalances =>
            new Map([...prevBalances, ...newBalances])
        );
    }

    function saveSetupData(data: SetupData) {
        sessionStorage.setItem(setupDataKey, JSON.stringify(data));
    }

    function loadSetupData(): SetupData|null {
        const dataRaw = sessionStorage.getItem(setupDataKey);
        if (!dataRaw) {
            return null;
        }
        const data: SetupData = JSON.parse(dataRaw);
        return data;
    }

    function clearSetupData(): void {
        sessionStorage.removeItem(setupDataKey);
    }

    function saveAccount(account: AccountData): void {
        const newAccounts = [account, ...accounts.current];
        sessionStorage.setItem(accountDataKey, JSON.stringify(newAccounts));
        accounts.current = newAccounts;
        fetchBalances([account]);
    }

    function loadAccounts(): AccountData[] {
        const dataRaw = sessionStorage.getItem(accountDataKey);
        if (!dataRaw) {
            return [];
        }
        const data: AccountData[] = JSON.parse(dataRaw);
        return data;
    }

    function clearState(): void {
        sessionStorage.clear();
        accounts.current = [];
        setBalances(new Map());
    }

    const openIdProviders: OpenIdProvider[] = isLocalhost()
        ? ["Google", "Twitch", "Facebook"]
        : ["Google", "Twitch"];
        
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <Dialog open={modalContent !== null} onOpenChange={(open) => !open && setModalContent(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Loading</DialogTitle>
                    </DialogHeader>
                    {modalContent}
                </DialogContent>
            </Dialog>

            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">Sui zkLogin</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Log in:</h3>
                            <div className="flex flex-col space-y-2">
                                {openIdProviders.map(provider => (
                                    <Button
                                        key={provider}
                                        onClick={() => beginZkLogin(provider)}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {provider}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {accounts.current.length > 0 && (
                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-lg font-semibold">Accounts:</h3>
                                {accounts.current.map(acct => {
                                    const balance = balances.get(acct.userAddr);
                                    const explorerLink = makePolymediaUrl(NETWORK, "address", acct.userAddr);
                                    return (
                                        <div key={acct.userAddr} className="p-4 border rounded-lg space-y-2">
                                            <div>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800`}>
                                                    {acct.provider}
                                                </span>
                                            </div>
                                            <div>
                                                <strong>Address:</strong>{" "}
                                                <a href={explorerLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                    {shortenAddress(acct.userAddr)}
                                                </a>
                                            </div>
                                            <div><strong>User ID:</strong> {acct.sub}</div>
                                            <div><strong>Balance:</strong> {typeof balance === "undefined" ? "(loading)" : `${balance} SUI`}</div>
                                            <Button
                                                onClick={() => sendTransaction(acct)}
                                                disabled={!balance}
                                                className="w-full"
                                            >
                                                Send transaction
                                            </Button>
                                            {balance === 0 && (
                                                <Button
                                                    onClick={() => {
                                                        requestSuiFromFaucet(NETWORK, acct.userAddr);
                                                        setModalContent("💰 Requesting SUI from faucet...");
                                                        setTimeout(() => setModalContent(null), 3000);
                                                    }}
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    Use faucet
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <Button onClick={clearState} variant="destructive" className="w-full">
                                🧨 Clear State
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
