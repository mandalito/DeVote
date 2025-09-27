'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNetworkVariable } from "@/app/networkConfig";
import { Transaction } from '@mysten/sui/transactions';
import { useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';

// Real poll fetching and display component


type Poll = {
    id: string;
    name: string;
    description: string;
    choices: string[]; // Array of project IDs
    deadline_ms: string;
    finalized: boolean;
    tally: { [projectId: string]: string }; // Vote counts as strings
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
                            const poll: Poll = {
                                id: pollResponse.data.objectId,
                                name: fields.name,
                                description: fields.description,
                                choices: fields.choices,
                                deadline_ms: fields.deadline_ms,
                                finalized: fields.finalized,
                                tally: fields.tally?.fields || {}
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
                            <CardTitle>{poll.name}</CardTitle>
                            <CardDescription>{poll.description}</CardDescription>
                            <div className="text-sm text-gray-500 space-y-1">
                                <p>Deadline: {new Date(parseInt(poll.deadline_ms)).toLocaleString()}</p>
                                <p>Status: {poll.finalized ? 'Finalized' : 'Active'}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
}
