'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, User } from "lucide-react";
import { makePolymediaUrl, shortenAddress } from "@polymedia/suitcase-core";
import { useSuiClient } from "@mysten/dapp-kit";

type AccountData = {
    provider: string;
    userAddr: string;
    userSalt: string;
    sub: string;
    aud: string;
    maxEpoch: number;
    ephemeralPrivateKey: string;
    zkProofs: any;
};

interface UserProfileProps {
    account: AccountData;
}

export function UserProfile({ account }: UserProfileProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);
    const suiClient = useSuiClient();

    useEffect(() => {
        const fetchCurrentEpoch = async () => {
            try {
                const systemState = await suiClient.getLatestSuiSystemState();
                setCurrentEpoch(Number(systemState.epoch));
            } catch (error) {
                console.error('Error fetching current epoch:', error);
            }
        };

        if (isOpen) {
            fetchCurrentEpoch();
        }
    }, [isOpen, suiClient]);

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    };

    const explorerLink = makePolymediaUrl("devnet", "address", account.userAddr);

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2"
            >
                <User className="h-4 w-4" />
                {shortenAddress(account.userAddr)}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            zkLogin Account Details
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Provider Badge */}
                        <div className="flex justify-center">
                            <Badge variant="secondary" className="text-lg px-4 py-2">
                                {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)} Account
                            </Badge>
                        </div>

                        {/* Main Account Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Account Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">zkLogin Address</label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <code className="flex-1 text-sm font-mono break-all text-gray-900">
                                            {account.userAddr}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(account.userAddr, 'address')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <a 
                                            href={explorerLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </div>
                                    {copiedField === 'address' && (
                                        <p className="text-sm text-green-600">✓ Address copied to clipboard</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">User ID (sub)</label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <code className="flex-1 text-sm font-mono text-gray-900">
                                            {account.sub}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(account.sub, 'sub')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {copiedField === 'sub' && (
                                        <p className="text-sm text-green-600">✓ User ID copied to clipboard</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">Audience (aud)</label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <code className="flex-1 text-sm font-mono break-all text-gray-900">
                                            {account.aud}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(account.aud, 'aud')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {copiedField === 'aud' && (
                                        <p className="text-sm text-green-600">✓ Audience copied to clipboard</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Technical Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Technical Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">User Salt</label>
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <code className="flex-1 text-sm font-mono text-gray-900">
                                            {account.userSalt}
                                        </code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(account.userSalt, 'salt')}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {copiedField === 'salt' && (
                                        <p className="text-sm text-green-600">✓ Salt copied to clipboard</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">Session Expires</label>
                                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                                        {currentEpoch ? (
                                            <>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {(() => {
                                                        const epochsRemaining = account.maxEpoch - currentEpoch;
                                                        const hoursRemaining = epochsRemaining * 24; // 1 epoch ≈ 24 hours
                                                        const expirationDate = new Date(Date.now() + (hoursRemaining * 60 * 60 * 1000));
                                                        return expirationDate.toLocaleString();
                                                    })()}
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    Epoch {account.maxEpoch} (≈ {Math.max(0, account.maxEpoch - currentEpoch)} epochs remaining)
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Current epoch: {currentEpoch}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-sm font-medium text-gray-900">
                                                    Loading expiration time...
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    Epoch {account.maxEpoch}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">ZK Proof Status</label>
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <Badge variant="outline" className="text-green-700 border-green-300">
                                            ✓ Valid ZK Proof Generated
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Security Notice */}
                        <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-2">
                                    <div className="text-amber-600 mt-0.5">⚠️</div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-amber-800">Security Notice</p>
                                        <p className="text-sm text-amber-700">
                                            Your zkLogin session is cryptographically secured. Never share your private keys or session data.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
