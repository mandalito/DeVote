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
    const [name, setName] = useState("Dynamic Poll: Best Team/Individual");
    const [description, setDescription] = useState("A dynamic poll where participants create their own groups or represent themselves individually.");
    
    // Initialize deadline to 24 hours from now in datetime-local format
    const getDefaultDeadline = () => {
        const tomorrow = new Date(Date.now() + 86400000); // 24 hours from now
        return tomorrow.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
    };
    const [deadlineDate, setDeadlineDate] = useState(getDefaultDeadline());
    
    // Poll type selection
    const [pollType, setPollType] = useState<"individual" | "group">("individual");
    const [maxGroups, setMaxGroups] = useState(10);
    const [participantsPerGroup, setParticipantsPerGroup] = useState(1); // 1 for individual, more for groups
    
    const votingPackageId = useNetworkVariable("votingPackageId");
    const pollRegistryId = useNetworkVariable("pollRegistryId");
    const allNetworkVars = useNetworkVariables();

    const create = () => {
        const tx = new Transaction();
        
        // Convert datetime-local to Unix timestamp in milliseconds
        const deadlineTimestamp = new Date(deadlineDate).getTime();

        console.log("Creating dynamic poll with:");
        console.log("- Package ID:", votingPackageId);
        console.log("- Name:", name);
        console.log("- Description:", description);
        console.log("- Poll Type:", pollType);
        console.log("- Max Groups:", maxGroups);
        console.log("- Participants Per Group:", participantsPerGroup);
        console.log("- Deadline Date:", deadlineDate);
        console.log("- Deadline Unix Timestamp:", deadlineTimestamp);
        
        // Debug network configuration
        console.log("Network config debug:");
        console.log("- useNetworkVariable result:", votingPackageId);
        console.log("- All network variables:", JSON.stringify(allNetworkVars, null, 2));
        console.log("- Expected devnet package ID: 0x2280151e6f09a81aaffec74b11a9e2e7175907e255cbd68da0a0c5f26da4721b");
        
        // Let's also check the RPC URL
        console.log("- Frontend devnet RPC URL:", getFullnodeUrl('devnet'));
        console.log("- CLI devnet RPC URL: https://fullnode.devnet.sui.io:443");

        // Create dynamic poll (no hardcoded choices)
        tx.moveCall({
            target: `${votingPackageId}::voting::create_dynamic_poll`,
            arguments: [
                tx.object(pollRegistryId),           // PollRegistry
                tx.pure.string(name),                // String
                tx.pure.string(description),         // String
                tx.pure.u64(String(deadlineTimestamp)), // u64 - Unix timestamp
                tx.pure.string(pollType),            // String - "individual" or "group"
                tx.pure.u64(String(maxGroups)),     // u64 - Max groups
                tx.pure.u64(String(participantsPerGroup)), // u64 - Participants per group
            ],
        });

        execute(tx, {
            onSuccess: (result) => {
                console.log("Dynamic poll created successfully:", result);
                console.log("Full result object:", JSON.stringify(result, null, 2));
                
                let pollId = null;
                
                // Method 1: Check objectChanges for created Poll objects
                if (result.objectChanges) {
                    const pollChange = result.objectChanges.find((change: any) => 
                        change.type === 'created' && 
                        change.objectType && 
                        change.objectType.includes('::voting::Poll')
                    );
                    
                    if (pollChange) {
                        pollId = pollChange.objectId;
                        console.log("Found poll ID from objectChanges:", pollId);
                    }
                }
                
                // Method 2: Check effects.created (if available)
                if (!pollId && result.effects?.created) {
                    const createdObjects = result.effects.created;
                    const pollObject = createdObjects.find((obj: any) => 
                        obj.reference?.objectId
                    );
                    
                    if (pollObject) {
                        pollId = pollObject.reference.objectId;
                        console.log("Found poll ID from effects.created:", pollId);
                    }
                }
                
                if (pollId) {
                    console.log("Created dynamic poll ID:", pollId);
                    console.log("Poll automatically registered in PollRegistry on-chain!");
                    
                    onCreated(pollId);
                    
                    const pollTypeDisplay = pollType === "individual" ? "Individual" : "Group-based";
                    const capacityInfo = pollType === "individual" 
                        ? `${maxGroups} individual participants`
                        : `${maxGroups} groups × ${participantsPerGroup} members = ${maxGroups * participantsPerGroup} total capacity`;
                    
                    alert(`🎉 ${pollTypeDisplay} Poll Created!\n\nID: ${pollId.slice(0, 10)}...\nCapacity: ${capacityInfo}\n\nParticipants can now join and create their own groups!`);
                } else {
                    console.warn("Could not extract poll ID from result. Available keys:", Object.keys(result));
                    onCreated(result.digest);
                    alert("Poll created successfully! Check console for transaction details.");
                }
            }
        });
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Create a Dynamic Poll</CardTitle>
                <CardDescription>
                    Create a poll where participants can form their own groups or represent themselves individually.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Poll Name</Label>
                        <Input 
                            id="name" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="e.g., Best Innovation Project 2024" 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea 
                            id="description" 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="Describe what participants will be voting for..." 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="deadline">Poll Deadline</Label>
                        <input 
                            id="deadline" 
                            type="datetime-local" 
                            value={deadlineDate} 
                            onChange={(e) => setDeadlineDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)} // Prevent selecting past dates
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                colorScheme: 'dark',
                                filter: 'invert(1)'
                            }}
                        />
                        <p className="text-xs text-gray-500">
                            Selected: {new Date(deadlineDate).toLocaleString()} 
                            ({new Date(deadlineDate).getTime()}ms)
                        </p>
                    </div>

                    {/* Poll Type Selection */}
                    <div className="space-y-4 border-t pt-4">
                        <div>
                            <Label className="text-base font-semibold">Poll Type</Label>
                            <p className="text-sm text-gray-500 mb-3">Choose how participants will be organized</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Individual Type */}
                            <div 
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                    pollType === "individual" 
                                        ? "border-blue-500 bg-blue-50" 
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                                onClick={() => {
                                    setPollType("individual");
                                    setParticipantsPerGroup(1);
                                }}
                            >
                                <div className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        id="individual" 
                                        name="pollType"
                                        checked={pollType === "individual"}
                                        onChange={() => {}}
                                        className="rounded"
                                    />
                                    <Label htmlFor="individual" className="font-medium cursor-pointer">
                                        🙋‍♂️ Individual Participants
                                    </Label>
                                </div>
                                <p className="text-sm text-gray-600 ml-6">
                                    Each person represents themselves. Perfect for personal achievements, individual projects, or solo competitions.
                                </p>
                            </div>

                            {/* Group Type */}
                            <div 
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                    pollType === "group" 
                                        ? "border-blue-500 bg-blue-50" 
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                                onClick={() => {
                                    setPollType("group");
                                    setParticipantsPerGroup(3);
                                }}
                            >
                                <div className="flex items-center space-x-2 mb-2">
                                    <input 
                                        type="radio" 
                                        id="group" 
                                        name="pollType"
                                        checked={pollType === "group"}
                                        onChange={() => {}}
                                        className="rounded"
                                    />
                                    <Label htmlFor="group" className="font-medium cursor-pointer">
                                        👥 Team Groups
                                    </Label>
                                </div>
                                <p className="text-sm text-gray-600 ml-6">
                                    Participants form teams. Great for collaborative projects, team competitions, or group achievements.
                                </p>
                            </div>
                        </div>
                        
                        {/* Configuration Options */}
                        <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                            <div className="space-y-2">
                                <Label htmlFor="maxGroups">
                                    {pollType === "individual" ? "Maximum Participants" : "Maximum Groups"}
                                </Label>
                                <Input 
                                    id="maxGroups" 
                                    type="number" 
                                    min="2" 
                                    max="50"
                                    value={maxGroups} 
                                    onChange={(e) => setMaxGroups(parseInt(e.target.value) || 2)} 
                                    placeholder={pollType === "individual" ? "e.g., 20" : "e.g., 5"} 
                                />
                            </div>
                            
                            {pollType === "group" && (
                                <div className="space-y-2">
                                    <Label htmlFor="participantsPerGroup">Members per Group</Label>
                                    <Input 
                                        id="participantsPerGroup" 
                                        type="number" 
                                        min="2" 
                                        max="10"
                                        value={participantsPerGroup} 
                                        onChange={(e) => setParticipantsPerGroup(parseInt(e.target.value) || 2)} 
                                        placeholder="e.g., 3" 
                                    />
                                </div>
                            )}
                            
                            <div className="text-sm text-gray-600 bg-white p-3 rounded border">
                                <strong>📊 Poll Capacity:</strong> {" "}
                                {pollType === "individual" 
                                    ? `${maxGroups} individual participants`
                                    : `${maxGroups} groups × ${participantsPerGroup} members = ${maxGroups * participantsPerGroup} total participants`
                                }
                            </div>
                        </div>
                    </div>

                    <Button onClick={create} className="w-full" disabled={isPending}>
                        {isPending ? "Creating..." : `Create ${pollType === "individual" ? "Individual" : "Group"} Poll`}
                    </Button>
                    
                    <div className="text-xs text-gray-500 space-y-1">
                        <p>💡 <strong>How it works:</strong></p>
                        <ul className="ml-4 space-y-1">
                            {pollType === "individual" ? (
                                <>
                                    <li>• Each participant joins as an individual</li>
                                    <li>• First person to join a slot can name themselves</li>
                                    <li>• Participants vote for other individuals</li>
                                </>
                            ) : (
                                <>
                                    <li>• Participants form teams of {participantsPerGroup} members</li>
                                    <li>• First person to join a group can name and describe it</li>
                                    <li>• Teams must be full before they can vote</li>
                                    <li>• Teams vote for other teams (not themselves)</li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}