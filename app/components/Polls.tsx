'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNetworkVariable } from "@/app/networkConfig";
import { Transaction } from '@mysten/sui/transactions';

// This is a placeholder component.
// In the future, it will fetch and display a list of polls.
const getRandomHex = () => `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
const FAKE_POLL_ID_1 = getRandomHex();
const FAKE_POLL_ID_2 = getRandomHex();
const FAKE_CHOICE_ID_A = getRandomHex();
const FAKE_CHOICE_ID_B = getRandomHex();
const FAKE_CHOICE_ID_C = getRandomHex();
const FAKE_CHOICE_ID_D = getRandomHex();
const FAKE_CHOICE_ID_E = getRandomHex();
const FAKE_CHOICE_ID_F = getRandomHex();


type Poll = {
    id: string;
    name: string;
    description: string;
    choices: { id: string, name: string }[];
    votes: Record<string, number>;
};

// Replace with actual poll data fetching
const samplePolls: Poll[] = [
    {
        id: FAKE_POLL_ID_1, // Replace with actual on-chain object IDs
        name: "Favorite Programming Language",
        description: "What is your favorite language for smart contracts?",
        choices: [
            { id: FAKE_CHOICE_ID_A, name: "Move" },
            { id: FAKE_CHOICE_ID_B, name: "Rust" },
            { id: FAKE_CHOICE_ID_C, name: "Solidity" },
        ],
        votes: { [FAKE_CHOICE_ID_A]: 10, [FAKE_CHOICE_ID_B]: 5, [FAKE_CHOICE_ID_C]: 2 },
    },
    {
        id: FAKE_POLL_ID_2, // Replace with actual on-chain object IDs
        name: "Next Hackathon Location",
        description: "Where should we host the next Sui hackathon?",
        choices: [
            { id: FAKE_CHOICE_ID_D, name: "Paris" },
            { id: FAKE_CHOICE_ID_E, name: "New York" },
            { id: FAKE_CHOICE_ID_F, name: "Singapore" },
        ],
        votes: { [FAKE_CHOICE_ID_D]: 8, [FAKE_CHOICE_ID_E]: 12, [FAKE_CHOICE_ID_F]: 7 },
    },
];


type PollsProps = {
    execute: (tx: Transaction) => Promise<any>;
    isPending: boolean;
    walletAddress?: string;
    zkLoginAccountAddress?: string;
};

export function Polls({ execute, isPending, walletAddress, zkLoginAccountAddress }: PollsProps) {
    const votingPackageId = useNetworkVariable('votingPackageId');
    const votingRegistryId = useNetworkVariable('votingRegistryId');
    const polls = samplePolls; // Use sample data for now

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

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Available Polls</h2>
            {polls.map((poll) => (
                <Card key={poll.id}>
                    <CardHeader>
                        <CardTitle>{poll.name}</CardTitle>
                        <CardDescription>{poll.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="font-semibold">Choices:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            {poll.choices.map((choice) => (
                                <Button
                                    key={choice.id}
                                    variant="outline"
                                    onClick={() => handleVote(poll.id, choice.id)}
                                    disabled={isPending}
                                >
                                    {choice.name} ({poll.votes[choice.id] || 0} votes)
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
