'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, User } from "lucide-react";
import { makePolymediaUrl, shortenAddress } from "@polymedia/suitcase-core";

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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <a href={explorerLink} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
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
                                    <label className="text-sm font-medium text-gray-600">Session Valid Until Epoch</label>
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <code className="text-sm font-mono text-gray-900">
                                            {account.maxEpoch}
                                        </code>
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
