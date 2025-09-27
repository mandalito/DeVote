'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable, useNetworkVariables } from "../networkConfig";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

// AdminCap is no longer needed - each poll creator gets their own AdminCap automatically

// We'll use the Project objects we created as poll choices.
const DUMMY_CHOICE_1 = "0x1acd97d251ba9b53d322e7e8d1b95d8ef746afcd06a47c54609a1ebf867d16cc"; // Project Alpha (devnet)
const DUMMY_CHOICE_2 = "0x2f464feace37e030292265c426fa36001a72ed8ce842bdf1dd191210e58ac092"; // Project Beta (devnet)

export function CreatePoll({
    execute,
    isPending,
    onCreated,
}: {
    execute: (
        transaction: Transaction,
        options?: { onSuccess: (result: any) => void }
    ) => void;
    isPending: boolean;
    onCreated: (id: string) => void;
}) {
    const [name, setName] = useState("Dummy Poll: Best System Object?");
    const [description, setDescription] = useState("A poll to decide the best system object.");
    const [choices, setChoices] = useState(`${DUMMY_CHOICE_1}, ${DUMMY_CHOICE_2}`);
    const [deadline, setDeadline] = useState(String(Date.now() + 86400000)); // 24 hours from now
    const votingPackageId = useNetworkVariable("votingPackageId");
    const allNetworkVars = useNetworkVariables();

    const create = () => {
        const tx = new Transaction();
        //tx.setSender("0xc899b84f50e994b0b595c38919f0ca4e0b94f7758548e2494b1a6c9ddfdbfbfb");
        const choiceIds = choices.split(",").map(s => s.trim()).filter(Boolean);

        console.log("Creating transaction with:");
        console.log("- Package ID:", votingPackageId);
        console.log("- Choice IDs:", choiceIds);
        console.log("- Name:", name);
        console.log("- Description:", description);
        console.log("- Deadline:", deadline);
        
        // Debug network configuration
        console.log("Network config debug:");
        console.log("- useNetworkVariable result:", votingPackageId);
        console.log("- All network variables:", JSON.stringify(allNetworkVars, null, 2));
        console.log("- Expected devnet package ID: 0x5833033134626ae19f7de7d92b1b82b46f6976830499cd401d57315371ddf55b");
        
        // Let's also check the RPC URL
        console.log("- Frontend devnet RPC URL:", getFullnodeUrl('devnet'));
        console.log("- CLI devnet RPC URL: https://fullnode.devnet.sui.io:443");

        tx.moveCall({
            target: `${votingPackageId}::voting::create_simple_poll`,
            arguments: [
                tx.pure.string(name),            // String
                tx.pure.string(description), 
                //tx.pure.vector('id', [ choiceIds[0]]),    // String
               tx.pure.id(choiceIds[0]),         // ID (choice1)
               tx.pure.id(choiceIds[1] || choiceIds[0]), // ID (choice2, fallback to choice1 if only one)
                tx.pure.u64(String(deadline)),   // u64
            ],
        });

        /*
       const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
        tx.build({ client: suiClient }).then(result => {
            console.log("Poll created successfully:", result);
            alert("Poll created successfully!");
        }).catch(error => {
            console.error("Failed to create poll:", error);
            alert("Failed to create poll. See console for details.");
        });

        */

        execute(tx, {
            onSuccess: (result) => {
                console.log("Poll created successfully:", result);
                alert("Poll created successfully!");
            }
        });
    }

    return (
        <Card className="max-w-lg mx-auto">
            <CardHeader>
                <CardTitle>Create a New Poll</CardTitle>
                <CardDescription>Fill out the details below to create a new poll.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Poll Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Favorite Programming Language" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief description of the poll" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="choices">Choices (comma-separated Project IDs)</Label>
                        <Input id="choices" value={choices} onChange={(e) => setChoices(e.target.value)} placeholder="0x..., 0x..., 0x..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="deadline">Deadline (Unix timestamp in ms)</Label>
                        <Input id="deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="e.g., 1735689600000" type="number" />
                    </div>
                    <Button onClick={create} className="w-full" disabled={isPending}>
                        {isPending ? "Creating..." : "Create Poll"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
