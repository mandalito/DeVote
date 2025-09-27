'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNetworkVariable } from "@/app/networkConfig";
import { Transaction } from '@mysten/sui/transactions';
import { useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { bcs } from '@mysten/sui/bcs';

// Real poll fetching and display component


type Poll = {
    id: string;
    name: string;
    description: string;
    choices: string[]; // Array of project IDs
    deadline_ms: string;
    finalized: boolean;
    tally: { [projectId: string]: string }; // Vote counts as strings
    // Group-based voting fields
    groups_enabled: boolean;
    max_groups: string;
    participants_per_group: string;
    groups: { [groupId: string]: Group };
    user_to_group: { [userAddress: string]: string };
};

type Group = {
    id: string;
    members: string[];
    is_full: boolean;
};

type Project = {
    id: string;
    name: string;
    description: string;
};


type PollsProps = {
    execute: (tx: Transaction) => Promise<any>;
    isPending: boolean;
    walletAddress?: string;
    zkLoginAccountAddress?: string;
    refreshTrigger?: number; // Add trigger to refresh polls
};

export function Polls({ execute, isPending, walletAddress, zkLoginAccountAddress, refreshTrigger }: PollsProps) {
    const suiClient = useSuiClient();
    const votingPackageId = useNetworkVariable('votingPackageId');
    const votingRegistryId = useNetworkVariable('votingRegistryId');
    const pollRegistryId = useNetworkVariable('pollRegistryId');
    const [polls, setPolls] = useState<Poll[]>([]);
    const [projects, setProjects] = useState<{ [id: string]: Project }>({});
    const [loading, setLoading] = useState(true);

    // Fetch all polls and their associated projects
    useEffect(() => {
        const fetchPolls = async () => {
            if (!votingPackageId || !pollRegistryId) return;
            
            try {
                setLoading(true);
                
                // Fetch poll IDs from the PollRegistry
                console.log("Fetching polls from PollRegistry:", pollRegistryId);
                
                const registryResponse = await suiClient.getObject({
                    id: pollRegistryId,
                    options: {
                        showContent: true,
                        showType: true
                    }
                });

                let pollIds: string[] = [];
                if (registryResponse.data?.content && 'fields' in registryResponse.data.content) {
                    const fields = registryResponse.data.content.fields as any;
                    pollIds = fields.polls || [];
                    console.log("Found poll IDs from registry:", pollIds);
                } else {
                    console.log("No polls found in registry or registry not found");
                }
                
                const pollsData: Poll[] = [];
                const projectIds = new Set<string>();
                
                // Fetch each poll by ID
                for (const pollId of pollIds) {
                    try {
                        const pollResponse = await suiClient.getObject({
                            id: pollId,
                            options: {
                                showContent: true,
                                showType: true
                            }
                        });

                        if (pollResponse.data?.content && 'fields' in pollResponse.data.content) {
                            const fields = pollResponse.data.content.fields as any;
                            
                            // Fetch group data using smart contract helper functions
                            let groupsData: { [groupId: string]: Group } = {};
                            let userToGroupData: { [userAddress: string]: string } = {};
                            
                            if (fields.groups_enabled && zkLoginAccountAddress) {
                                try {
                                    // Check which group the current user is in
                                    const userGroupResult = await suiClient.devInspectTransactionBlock({
                                        transactionBlock: (() => {
                                            const tx = new Transaction();
                                            tx.moveCall({
                                                target: `${votingPackageId}::voting::get_user_group_id`,
                                                arguments: [
                                                    tx.object(pollId),
                                                    tx.pure.address(zkLoginAccountAddress)
                                                ]
                                            });
                                            return tx;
                                        })(),
                                        sender: zkLoginAccountAddress
                                    });
                                    
                                    if (userGroupResult.results?.[0]?.returnValues?.[0]) {
                                        const userGroupId = parseInt(userGroupResult.results[0].returnValues[0][0]);
                                        if (userGroupId !== 999) { // 999 means not in any group
                                            userToGroupData[zkLoginAccountAddress] = userGroupId.toString();
                                        }
                                    }
                                    
                                    // Fetch group members for each group
                                    const maxGroups = parseInt(fields.max_groups || '0');
                                    for (let i = 0; i < maxGroups; i++) {
                                        try {
                                            const groupMembersResult = await suiClient.devInspectTransactionBlock({
                                                transactionBlock: (() => {
                                                    const tx = new Transaction();
                                                    tx.moveCall({
                                                        target: `${votingPackageId}::voting::get_group_members`,
                                                        arguments: [
                                                            tx.object(pollId),
                                                            tx.pure.u64(i.toString())
                                                        ]
                                                    });
                                                    return tx;
                                                })(),
                                                sender: zkLoginAccountAddress
                                            });
                                            
                                            if (groupMembersResult.results?.[0]?.returnValues?.[0]) {
                                                const returnValue = groupMembersResult.results[0].returnValues[0];
                                                console.log(`Group ${i} raw data:`, returnValue);
                                                
                                                // Parse the members array from the BCS encoded result
                                                let members: string[] = [];
                                                try {
                                                    if (returnValue[0] && Array.isArray(returnValue[0])) {
                                                        const rawBytes = returnValue[0];
                                                        console.log(`Group ${i} raw bytes length:`, rawBytes.length);
                                                        
                                                        if (rawBytes.length > 1) {
                                                            // BCS encoded vector of addresses
                                                            // First byte is the vector length, then 32 bytes per address
                                                            const vectorLength = rawBytes[0];
                                                            console.log(`Group ${i} vector length:`, vectorLength);
                                                            
                                                            if (vectorLength > 0 && rawBytes.length >= 1 + (vectorLength * 32)) {
                                                                for (let addrIdx = 0; addrIdx < vectorLength; addrIdx++) {
                                                                    const startIdx = 1 + (addrIdx * 32); // Skip length byte
                                                                    const endIdx = startIdx + 32;
                                                                    const addrBytes = rawBytes.slice(startIdx, endIdx);
                                                                    const addr = `0x${addrBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`;
                                                                    members.push(addr);
                                                                }
                                                            }
                                                        } else if (rawBytes.length === 1 && rawBytes[0] === 0) {
                                                            // Empty vector (length = 0)
                                                            console.log(`Group ${i} is empty`);
                                                        }
                                                    }
                                                } catch (parseError) {
                                                    console.warn(`Failed to parse group ${i} members:`, parseError);
                                                }
                                                
                                                console.log(`Group ${i} parsed members:`, members);
                                                
                                                groupsData[i.toString()] = {
                                                    id: i.toString(),
                                                    members: members,
                                                    is_full: members.length >= parseInt(fields.participants_per_group || '0')
                                                };
                                            }
                                        } catch (error) {
                                            console.warn(`Failed to fetch group ${i} members:`, error);
                                        }
                                    }
                                } catch (error) {
                                    console.warn('Failed to fetch group data:', error);
                                }
                            }
                            
                            const poll: Poll = {
                                id: pollResponse.data.objectId,
                                name: fields.name,
                                description: fields.description,
                                choices: fields.choices,
                                deadline_ms: fields.deadline_ms,
                                finalized: fields.finalized,
                                tally: fields.tally?.fields || {},
                                // Group-based voting fields with real data
                                groups_enabled: fields.groups_enabled || false,
                                max_groups: fields.max_groups || '0',
                                participants_per_group: fields.participants_per_group || '0',
                                groups: groupsData,
                                user_to_group: userToGroupData,
                            };
                            pollsData.push(poll);
                            
                            // Collect all project IDs for fetching
                            fields.choices.forEach((projectId: string) => {
                                projectIds.add(projectId);
                            });
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch poll ${pollId}:`, error);
                    }
                }

                // Fetch all Project objects
                const projectsData: { [id: string]: Project } = {};
                for (const projectId of projectIds) {
                    try {
                        const projectResponse = await suiClient.getObject({
                            id: projectId,
                            options: {
                                showContent: true,
                                showType: true
                            }
                        });

                        if (projectResponse.data?.content && 'fields' in projectResponse.data.content) {
                            const fields = projectResponse.data.content.fields as any;
                            projectsData[projectId] = {
                                id: projectId,
                                name: fields.name,
                                description: fields.description
                            };
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch project ${projectId}:`, error);
                        // Add fallback project data
                        projectsData[projectId] = {
                            id: projectId,
                            name: `Project ${projectId.slice(0, 8)}...`,
                            description: 'Project details unavailable'
                        };
                    }
                }

                setPolls(pollsData);
                setProjects(projectsData);
            } catch (error) {
                console.error('Failed to fetch polls:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPolls();
    }, [suiClient, votingPackageId, pollRegistryId, refreshTrigger]); // Add pollRegistryId to dependencies

    const handleJoinGroup = async (pollId: string, groupId: number) => {
        if (!votingPackageId) {
            console.error("Package ID not found in network config");
            return;
        }

        const tx = new Transaction();

        tx.moveCall({
            target: `${votingPackageId}::voting::join_group`,
            arguments: [
                tx.object(pollId),
                tx.pure.u64(String(groupId)),
            ],
        });

        try {
            await execute(tx);
            console.log("Successfully joined group:", groupId);
            alert(`Successfully joined Group ${groupId + 1}! The page will refresh to show updated group membership.`);
            // Refresh polls to show updated group membership
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error("Failed to join group:", error);
            if (error.message.includes("13")) {
                alert("You're already in a group for this poll! Refresh the page to see your current group membership.");
            } else {
                alert("Failed to join group. See console for details.");
            }
        }
    };

    const handleGroupVote = async (pollId: string, choiceId: string) => {
        if (!votingPackageId) {
            console.error("Package ID not found in network config");
            return;
        }

        const tx = new Transaction();

        tx.moveCall({
            target: `${votingPackageId}::voting::group_vote`,
            arguments: [
                tx.object(pollId),
                tx.pure.id(choiceId),
            ],
        });

        try {
            await execute(tx);
            console.log("Group vote cast successfully for choice:", choiceId);
        } catch (error) {
            console.error("Failed to cast group vote:", error);
            alert("Failed to cast vote. See console for details.");
        }
    };

    const handleVote = async (pollId: string, choiceId: string) => {
        if (!votingPackageId || !votingRegistryId) {
            console.error("Package ID or Registry ID not found in network config");
            return;
        }

        const tx = new Transaction();

        tx.moveCall({
            target: `${votingPackageId}::voting::cast_vote`,
            arguments: [
                tx.object(votingRegistryId),
                tx.object(pollId),
                // TODO: Replace with a proper zkLogin nullifier. For now, using the user's address as a placeholder concept.
                // NOTE: This will fail if the user is not registered in the contract.
                tx.pure.vector('u8', Array.from(new TextEncoder().encode(zkLoginAccountAddress || walletAddress || ''))),
                tx.pure.id(choiceId),
                tx.object('0x6'), // Sui Clock object
            ],
        });

        try {
            await execute(tx);
            // TODO: Add success feedback and refetch poll data
            alert("Vote cast successfully!");
        } catch (error) {
            console.error("Failed to cast vote:", error);
            // TODO: Add user-friendly error feedback
            alert("Failed to cast vote. See console for details.");
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Available Polls</h2>
                <div className="text-center py-8">
                    <p className="text-gray-500">Loading polls...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Available Polls</h2>
            {polls.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">No polls found. Create the first poll above!</p>
                </div>
                   ) : (
                       polls.map((poll) => (
                <Card key={poll.id}>
                    <CardHeader>
                                   <CardTitle className="flex items-center gap-2">
                                       {poll.name}
                                       {poll.groups_enabled && (
                                           <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                               Team-Based
                                           </span>
                                       )}
                                   </CardTitle>
                        <CardDescription>{poll.description}</CardDescription>
                                   <div className="text-sm text-gray-500 space-y-1">
                                       <p>Deadline: {new Date(parseInt(poll.deadline_ms)).toLocaleString()}</p>
                                       <p>Status: {poll.finalized ? 'Finalized' : 'Active'}</p>
                                       {poll.groups_enabled && (
                                           <p>Groups: {poll.max_groups} groups × {poll.participants_per_group} participants</p>
                                       )}
                                   </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                                   {poll.groups_enabled ? (
                                       // Group-based poll UI
                                       <div className="space-y-6">
                                           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                               <h4 className="font-semibold mb-2 text-blue-800">🏆 Team-Based Voting System</h4>
                                               <div className="text-sm text-blue-700 space-y-1">
                                                   <p>• <strong>Groups:</strong> {poll.max_groups} teams of {poll.participants_per_group} members each</p>
                                                   <p>• <strong>Total Capacity:</strong> {parseInt(poll.max_groups) * parseInt(poll.participants_per_group)} participants</p>
                                                   <p>• <strong>Voting:</strong> Teams must be full before they can vote</p>
                                               </div>
                                           </div>

                                           <div>
                                               <h4 className="font-semibold mb-3">Available Groups</h4>
                                               <div className="grid gap-3">
                                                   {Array.from({ length: parseInt(poll.max_groups) }, (_, i) => {
                                                       const groupId = i.toString();
                                                       const group = poll.groups[groupId];
                                                       const members = group?.members || [];
                                                       const isFull = group?.is_full || false;
                                                       const userInThisGroup = zkLoginAccountAddress && poll.user_to_group[zkLoginAccountAddress] === groupId;
                                                       const userInAnyGroup = zkLoginAccountAddress && poll.user_to_group[zkLoginAccountAddress] !== undefined;
                                                       
                                                       return (
                                                           <div key={i} className="border rounded-lg p-3 bg-gray-50">
                                                               <div className="flex justify-between items-center mb-2">
                                                                   <h5 className="font-medium">Group {i + 1}</h5>
                                                                   <span className={`text-xs px-2 py-1 rounded-full ${
                                                                       isFull ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                                   }`}>
                                                                       {members.length}/{poll.participants_per_group} {isFull ? '✓ Ready' : 'Filling'}
                                                                   </span>
                                                               </div>
                                                               
                                                               <div className="space-y-2">
                                                   {members.length > 0 ? (
                                                       <div className="text-sm text-gray-600">
                                                           <div className="font-medium mb-1">Members ({members.length}):</div>
                                                           <div className="space-y-1">
                                                               {members.map((addr, idx) => (
                                                                   <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                                                       <code className="text-xs font-mono text-gray-800">
                                                                           {addr.slice(0, 10)}...{addr.slice(-8)}
                                                                       </code>
                                                                       {addr === zkLoginAccountAddress && (
                                                                           <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">You</span>
                                                                       )}
                                                                   </div>
                                                               ))}
                                                           </div>
                                                       </div>
                                                   ) : (
                                                       <div className="text-sm text-gray-500 italic">No members yet</div>
                                                   )}
                                                                   
                                                                   {userInThisGroup && (
                                                                       <div className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded">
                                                                           ✓ You're in this group!
                                                                       </div>
                                                                   )}
                                                                   
                                                                   {!poll.finalized && !userInAnyGroup && !isFull && (
                                                                       <Button
                                                                           size="sm"
                                                                           onClick={() => handleJoinGroup(poll.id, i)}
                                                                           disabled={isPending}
                                                                           className="w-full"
                                                                       >
                                                                           + Join Group {i + 1}
                                                                       </Button>
                                                                   )}
                                                                   
                                                                   {userInAnyGroup && !userInThisGroup && (
                                                                       <div className="text-xs text-gray-500 italic">
                                                                           You're already in another group
                                                                       </div>
                                                                   )}
                                                               </div>
                                                           </div>
                                                       );
                                                   })}
                                               </div>
                                           </div>

                                           <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                               <div className="flex justify-between items-center">
                                                   <div>
                                                       <p className="text-sm text-blue-800">
                                                           <strong>📊 Current Status:</strong> This poll has existing group memberships.
                                                           {zkLoginAccountAddress && (
                                                               <span className="block mt-1">
                                                                   <strong>Your Status:</strong> You may already be in a group. 
                                                                   Create a new poll to test fresh group joining!
                                                               </span>
                                                           )}
                                                       </p>
                                                   </div>
                                                   <Button 
                                                       size="sm" 
                                                       variant="outline"
                                                       onClick={() => window.location.reload()}
                                                       className="ml-4"
                                                   >
                                                       🔄 Refresh
                                                   </Button>
                                               </div>
                                           </div>
                                       </div>
                                   ) : (
                                       // Regular poll UI (existing)
                                       <div>
                        <p className="font-semibold">Choices:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                                               {poll.choices.map((projectId) => {
                                                   const project = projects[projectId];
                                                   const voteCount = poll.tally[projectId] || '0';
                                                   return (
                                <Button
                                                           key={projectId}
                                    variant="outline"
                                                           onClick={() => handleVote(poll.id, projectId)}
                                                           disabled={isPending || poll.finalized}
                                                           className="flex-1"
                                                       >
                                                           <div className="text-left">
                                                               <div className="font-medium">
                                                                   {project?.name || `Project ${projectId.slice(0, 8)}...`}
                                                               </div>
                                                               <div className="text-xs text-gray-500">
                                                                   {voteCount} votes
                                                               </div>
                                                           </div>
                                </Button>
                                                   );
                                               })}
                                           </div>
                        </div>
                                   )}
                    </CardContent>
                </Card>
                       ))
                   )}
        </div>
    );
}
