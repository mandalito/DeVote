'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNetworkVariable } from "@/app/networkConfig";
import { Transaction } from '@mysten/sui/transactions';
import { useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import { bcs } from '@mysten/sui/bcs';
import { makePolymediaUrl } from "@polymedia/suitcase-core";
import { ExternalLink, Clock } from "lucide-react";

// Simple dialog component for group naming
function GroupNameDialog({ 
    isOpen, 
    onClose, 
    onConfirm, 
    pollType 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: (name: string, description: string) => void;
    pollType: string;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim(), description.trim());
            setName('');
            setDescription('');
            onClose();
        }
    };

    if (!isOpen) return null;

    const isIndividual = pollType === 'individual';
    const title = isIndividual ? 'Introduce Yourself' : 'Name Your Group';
    const nameLabel = isIndividual ? 'Your Name/Title' : 'Group Name';
    const namePlaceholder = isIndividual ? 'e.g., John Smith - AI Researcher' : 'e.g., Team Alpha';
    const descLabel = isIndividual ? 'Your Background' : 'Group Description';
    const descPlaceholder = isIndividual ? 'Brief description of your work/expertise...' : 'What makes your team special...';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {nameLabel}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={namePlaceholder}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {descLabel}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={descPlaceholder}
                            className="w-full p-2 border border-gray-300 rounded-md text-gray-900 h-20 resize-none"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {isIndividual ? 'Join as Individual' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Real poll fetching and display component


type Poll = {
    id: string;
    name: string;
    description: string;
    choices: string[]; // Array of project IDs (empty for dynamic polls)
    deadline_ms: string;
    finalized: boolean;
    tally: { [projectId: string]: string }; // Vote counts as strings (for static polls)
    // Group-based voting fields
    groups_enabled: boolean;
    poll_type: string; // "individual", "group", or "simple"
    max_groups: string;
    participants_per_group: string;
    groups: { [groupId: string]: Group };
    user_to_group: { [userAddress: string]: string };
    group_tally: { [groupId: string]: string }; // Vote counts for dynamic polls
};

type Group = {
    id: string;
    name: string;
    description: string;
    members: string[];
    is_full: boolean;
    creator: string;
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
    const [showGroupDialog, setShowGroupDialog] = useState(false);
    const [selectedPoll, setSelectedPoll] = useState<{ pollId: string; groupId: number; pollType: string } | null>(null);
    const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());
    const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

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
                            
                            // Skip detailed group data loading for now - load on demand
                            let groupsData: { [groupId: string]: Group } = {};
                            let userToGroupData: { [userAddress: string]: string } = {};
                            
                            // Only load group data if this poll is expanded
                            if (false) { // Disabled for fast loading - will be loaded on expand
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
                                        const returnValue = userGroupResult.results[0].returnValues[0];
                                        console.log(`Poll ${pollId} - User group raw result:`, returnValue);
                                        
                                        // Parse u64 from BCS - it's encoded as 8 bytes
                                        let userGroupId = 999; // Default to "not in any group"
                                        
                                        if (Array.isArray(returnValue[0]) && returnValue[0].length === 8) {
                                            // BCS u64 is little-endian 8 bytes
                                            const bytes = returnValue[0];
                                            userGroupId = 0;
                                            for (let i = 0; i < 8; i++) {
                                                userGroupId += bytes[i] * Math.pow(256, i);
                                            }
                                        }
                                        
                                        console.log(`Poll ${pollId} - User group ID:`, userGroupId);
                                        if (userGroupId !== 999 && userGroupId < parseInt(fields.max_groups || '0')) { 
                                            // Only accept valid group IDs within the poll's range
                                            userToGroupData[zkLoginAccountAddress] = userGroupId.toString();
                                            console.log(`Poll ${pollId} - User ${zkLoginAccountAddress} is in group:`, userGroupId);
                                        } else {
                                            console.log(`Poll ${pollId} - User ${zkLoginAccountAddress} is not in any group (ID: ${userGroupId})`);
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
                                                    name: '', // Will be set when someone joins
                                                    description: '', // Will be set when someone joins
                                                    members: members,
                                                    is_full: members.length >= parseInt(fields.participants_per_group || '0'),
                                                    creator: members.length > 0 ? members[0] : '',
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
                                    choices: fields.choices || [],
                                    deadline_ms: fields.deadline_ms,
                                    finalized: fields.finalized,
                                    tally: fields.tally?.fields || {},
                                    // Group-based voting fields with real data
                                    groups_enabled: fields.groups_enabled || false,
                                    poll_type: fields.poll_type || 'simple',
                                    max_groups: fields.max_groups || '0',
                                    participants_per_group: fields.participants_per_group || '0',
                                    groups: groupsData,
                                    user_to_group: userToGroupData,
                                    group_tally: fields.group_tally?.fields || {},
                                };
                                
                                // Poll loaded with basic info only - details loaded on demand
                            pollsData.push(poll);
                            
                            // Collect all project IDs for fetching (only for static polls)
                            if (fields.choices && fields.choices.length > 0) {
                                fields.choices.forEach((projectId: string) => {
                                    projectIds.add(projectId);
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch poll ${pollId}:`, error);
                    }
                }

                // Fetch all Project objects
                const projectsData: { [id: string]: Project } = {};
                for (const projectId of Array.from(projectIds)) {
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
    }, [suiClient, votingPackageId, pollRegistryId, refreshTrigger]);

    // Load detailed group data for a specific poll (on-demand)
    const loadPollDetails = async (pollId: string) => {
        if (!votingPackageId || !zkLoginAccountAddress) return;
        
        setLoadingDetails(prev => new Set([...Array.from(prev), pollId]));
        
        try {
            console.log(`🔍 Loading detailed data for poll ${pollId}...`);
            
            const poll = polls.find(p => p.id === pollId);
            if (!poll || !poll.groups_enabled) return;
            
            let groupsData: { [groupId: string]: Group } = {};
            let userToGroupData: { [userAddress: string]: string } = {};
            
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
                const returnValue = userGroupResult.results[0].returnValues[0];
                
                // Parse u64 from BCS - it's encoded as 8 bytes
                let userGroupId = 999; // Default to "not in any group"
                
                if (Array.isArray(returnValue[0]) && returnValue[0].length === 8) {
                    // BCS u64 is little-endian 8 bytes
                    const bytes = returnValue[0];
                    userGroupId = 0;
                    for (let i = 0; i < 8; i++) {
                        userGroupId += bytes[i] * Math.pow(256, i);
                    }
                }
                
                if (userGroupId !== 999 && userGroupId < parseInt(poll.max_groups || '0')) { 
                    userToGroupData[zkLoginAccountAddress] = userGroupId.toString();
                }
            }
            
            // Fetch group members for each group
            const maxGroups = parseInt(poll.max_groups || '0');
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
                        
                        // Parse the members array from the BCS encoded result
                        let members: string[] = [];
                        try {
                            if (returnValue[0] && Array.isArray(returnValue[0])) {
                                const rawBytes = returnValue[0];
                                
                                if (rawBytes.length > 1) {
                                    // BCS encoded vector of addresses
                                    const vectorLength = rawBytes[0];
                                    
                                    if (vectorLength > 0 && rawBytes.length >= 1 + (vectorLength * 32)) {
                                        for (let addrIdx = 0; addrIdx < vectorLength; addrIdx++) {
                                            const startIdx = 1 + (addrIdx * 32);
                                            const endIdx = startIdx + 32;
                                            const addrBytes = rawBytes.slice(startIdx, endIdx);
                                            const addr = `0x${addrBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`;
                                            members.push(addr);
                                        }
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.warn(`Failed to parse group ${i} members:`, parseError);
                        }
                        
                                // Fetch group name and description if group has members
                                let groupName = '';
                                let groupDescription = '';
                                let groupCreator = '';
                                
                                if (members.length > 0) {
                                    try {
                                        // Get group name
                                        const nameResult = await suiClient.devInspectTransactionBlock({
                                            transactionBlock: (() => {
                                                const tx = new Transaction();
                                                tx.moveCall({
                                                    target: `${votingPackageId}::voting::get_group_name`,
                                                    arguments: [
                                                        tx.object(pollId),
                                                        tx.pure.u64(i.toString())
                                                    ]
                                                });
                                                return tx;
                                            })(),
                                            sender: zkLoginAccountAddress
                                        });
                                        
                                        if (nameResult.results?.[0]?.returnValues?.[0]) {
                                            const nameBytes = nameResult.results[0].returnValues[0][0];
                                            if (Array.isArray(nameBytes) && nameBytes.length > 1) {
                                                const nameLength = nameBytes[0];
                                                if (nameLength > 0) {
                                                    const nameStr = String.fromCharCode(...nameBytes.slice(1, 1 + nameLength));
                                                    groupName = nameStr;
                                                }
                                            }
                                        }
                                        
                                        // Get group description
                                        const descResult = await suiClient.devInspectTransactionBlock({
                                            transactionBlock: (() => {
                                                const tx = new Transaction();
                                                tx.moveCall({
                                                    target: `${votingPackageId}::voting::get_group_description`,
                                                    arguments: [
                                                        tx.object(pollId),
                                                        tx.pure.u64(i.toString())
                                                    ]
                                                });
                                                return tx;
                                            })(),
                                            sender: zkLoginAccountAddress
                                        });
                                        
                                        if (descResult.results?.[0]?.returnValues?.[0]) {
                                            const descBytes = descResult.results[0].returnValues[0][0];
                                            if (Array.isArray(descBytes) && descBytes.length > 1) {
                                                const descLength = descBytes[0];
                                                if (descLength > 0) {
                                                    const descStr = String.fromCharCode(...descBytes.slice(1, 1 + descLength));
                                                    groupDescription = descStr;
                                                }
                                            }
                                        }
                                        
                                        // Get group creator
                                        const creatorResult = await suiClient.devInspectTransactionBlock({
                                            transactionBlock: (() => {
                                                const tx = new Transaction();
                                                tx.moveCall({
                                                    target: `${votingPackageId}::voting::get_group_creator`,
                                                    arguments: [
                                                        tx.object(pollId),
                                                        tx.pure.u64(i.toString())
                                                    ]
                                                });
                                                return tx;
                                            })(),
                                            sender: zkLoginAccountAddress
                                        });
                                        
                                        if (creatorResult.results?.[0]?.returnValues?.[0]) {
                                            const creatorBytes = creatorResult.results[0].returnValues[0][0];
                                            if (Array.isArray(creatorBytes) && creatorBytes.length === 32) {
                                                groupCreator = `0x${creatorBytes.map((b: number) => b.toString(16).padStart(2, '0')).join('')}`;
                                            }
                                        }
                                    } catch (error) {
                                        console.warn(`Failed to fetch group ${i} details:`, error);
                                    }
                                }

                                groupsData[i.toString()] = {
                                    id: i.toString(),
                                    name: groupName,
                                    description: groupDescription,
                                    members: members,
                                    is_full: members.length >= parseInt(poll.participants_per_group || '0'),
                                    creator: groupCreator || (members.length > 0 ? members[0] : ''),
                                };
                    }
                } catch (error) {
                    console.warn(`Failed to fetch group ${i} members:`, error);
                }
            }
            
            // Update the specific poll with detailed data
            setPolls(prevPolls => 
                prevPolls.map(p => 
                    p.id === pollId 
                        ? { ...p, groups: groupsData, user_to_group: userToGroupData }
                        : p
                )
            );
            
            console.log(`✅ Loaded details for poll ${pollId}`);
            
        } catch (error) {
            console.error(`❌ Failed to load details for poll ${pollId}:`, error);
        } finally {
            setLoadingDetails(prev => {
                const newSet = new Set(Array.from(prev));
                newSet.delete(pollId);
                return newSet;
            });
        }
    };

    // Toggle poll expansion
    const togglePollExpansion = (pollId: string) => {
        const isExpanded = expandedPolls.has(pollId);
        
        if (isExpanded) {
            // Collapse
            setExpandedPolls(prev => {
                const newSet = new Set(Array.from(prev));
                newSet.delete(pollId);
                return newSet;
            });
        } else {
            // Expand and load details
            setExpandedPolls(prev => new Set([...Array.from(prev), pollId]));
            
            const poll = polls.find(p => p.id === pollId);
            if (poll && poll.groups_enabled && Object.keys(poll.groups).length === 0) {
                // Only load if we haven't loaded details yet
                loadPollDetails(pollId);
            }
        }
    };

    const handleJoinGroup = async (pollId: string, groupId: number, groupName?: string, groupDescription?: string) => {
        if (!votingPackageId) {
            console.error("Package ID not found in network config");
            return;
        }

        const tx = new Transaction();

        if (groupName && groupDescription) {
            // Join with name (for new groups)
            tx.moveCall({
                target: `${votingPackageId}::voting::join_group_with_name`,
                arguments: [
                    tx.object(pollId),
                    tx.pure.u64(String(groupId)),
                    tx.pure.string(groupName),
                    tx.pure.string(groupDescription),
                ],
            });
        } else {
            // Join existing group
            tx.moveCall({
                target: `${votingPackageId}::voting::join_group`,
                arguments: [
                    tx.object(pollId),
                    tx.pure.u64(String(groupId)),
                ],
            });
        }

        try {
            await execute(tx);
            console.log("Successfully joined group:", groupId);
            const groupDisplayName = groupName || `Group ${groupId + 1}`;
            alert(`Successfully joined ${groupDisplayName}! Loading updated group data...`);
            // Refresh the specific poll's details instead of full page reload
            await loadPollDetails(pollId);
        } catch (error) {
            console.error("Failed to join group:", error);
            if (error.message.includes("13")) {
                alert("You're already in a group for this poll! Refresh the page to see your current group membership.");
            } else {
                alert("Failed to join group. See console for details.");
            }
        }
    };

    const handleJoinGroupClick = (pollId: string, groupId: number, pollType: string, groupExists: boolean) => {
        if (groupExists) {
            // Join existing group directly
            handleJoinGroup(pollId, groupId);
        } else {
            // Show dialog to name the group/individual
            setSelectedPoll({ pollId, groupId, pollType });
            setShowGroupDialog(true);
        }
    };

    const handleGroupNameConfirm = (name: string, description: string) => {
        if (selectedPoll) {
            handleJoinGroup(selectedPoll.pollId, selectedPoll.groupId, name, description);
        }
        setSelectedPoll(null);
    };

    const handleVoteForGroup = async (pollId: string, targetGroupId: number) => {
        if (!votingPackageId) {
            console.error("Package ID not found in network config");
            return;
        }

        const tx = new Transaction();

        tx.moveCall({
            target: `${votingPackageId}::voting::vote_for_group`,
            arguments: [
                tx.object(pollId),
                tx.pure.u64(String(targetGroupId)),
            ],
        });

        try {
            await execute(tx);
            console.log("Successfully voted for group:", targetGroupId);
            alert(`Vote cast for Group ${targetGroupId + 1}! Loading updated results...`);
            // Refresh the specific poll's details
            await loadPollDetails(pollId);
        } catch (error) {
            console.error("Failed to vote for group:", error);
            alert("Failed to cast vote. See console for details.");
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

    // Helper function to check if poll is expired
    const isPollExpired = (poll: Poll) => {
        return Date.now() > parseInt(poll.deadline_ms);
    };

    // Helper function to check if poll is archived (finalized or expired)
    const isPollArchived = (poll: Poll) => {
        return poll.finalized || isPollExpired(poll);
    };

    // Filter polls based on active tab
    const filteredPolls = polls.filter(poll => {
        if (activeTab === 'active') {
            return !isPollArchived(poll);
        } else {
            return isPollArchived(poll);
        }
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex space-x-1 border-b border-gray-200">
                    <button className="px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent">
                        Available Polls
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent">
                        Archived Polls
                    </button>
                </div>
                <div className="text-center py-8">
                    <p className="text-gray-500">Loading polls...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex space-x-1 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${ 
                        activeTab === 'active'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Available Polls ({polls.filter(p => !isPollArchived(p)).length})
                </button>
                <button
                    onClick={() => setActiveTab('archived')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${ 
                        activeTab === 'archived'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Archived Polls ({polls.filter(p => isPollArchived(p)).length})
                </button>
            </div>

            {/* Poll List */}
            {filteredPolls.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-500">
                        {activeTab === 'active' 
                            ? 'No active polls found. Create the first poll above!' 
                            : 'No archived polls found.'}
                    </p>
                </div>
            ) : (
                filteredPolls.map((poll) => (
                <Card key={poll.id}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                {poll.name}
                                {poll.poll_type === 'individual' && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                        Individual
                                    </span>
                                )}
                                {poll.poll_type === 'group' && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        Team-Based
                                    </span>
                                )}
                                {poll.poll_type === 'simple' && (
                                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                                        Simple Poll
                                    </span>
                                )}
                            </CardTitle>
                            
                            {/* Explorer Link */}
                            <a 
                                href={makePolymediaUrl("devnet", "object", poll.id)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-gray-500 hover:text-gray-700"
                                title="View on Explorer"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>
                        <CardDescription>{poll.description}</CardDescription>
                        <div className="text-sm text-gray-500 space-y-1">
                            <p className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-500" />
                                <span>Deadline: {new Date(parseInt(poll.deadline_ms)).toLocaleString()}</span>
                            </p>
                            <p>Status: {poll.finalized ? 'Finalized' : isPollExpired(poll) ? 'Expired' : 'Active'}</p>
                            {poll.groups_enabled && (
                                <p>Capacity: {poll.max_groups} {poll.poll_type === 'individual' ? 'participants' : `groups × ${poll.participants_per_group} members`}</p>
                            )}
                        </div>
                        
                        {/* Expand/Collapse Button */}
                        {(poll.groups_enabled || poll.choices.length > 0) && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => togglePollExpansion(poll.id)}
                                    disabled={loadingDetails.has(poll.id)}
                                    className="flex items-center gap-2"
                                >
                                    {loadingDetails.has(poll.id) ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                                            Loading...
                                        </>
                                    ) : expandedPolls.has(poll.id) ? (
                                        <>
                                            ▼ Hide Details
                                        </>
                                    ) : (
                                        <>
                                            ▶ Show {poll.poll_type === 'individual' ? 'Participants' : poll.poll_type === 'group' ? 'Groups' : 'Choices'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Only show detailed content when expanded */}
                        {expandedPolls.has(poll.id) && (
                            <>
                                {poll.poll_type === 'individual' || poll.poll_type === 'group' ? (
                                    // Dynamic poll UI
                                    <div className="space-y-6">
                                <div className={`border rounded-lg p-4 ${
                                    poll.poll_type === 'individual' 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-blue-50 border-blue-200'
                                }`}>
                                    <h4 className={`font-semibold mb-2 ${
                                        poll.poll_type === 'individual' 
                                            ? 'text-green-800' 
                                            : 'text-blue-800'
                                    }`}>
                                        {poll.poll_type === 'individual' ? '🙋‍♂️ Individual Competition' : '🏆 Team-Based Competition'}
                                    </h4>
                                    <div className={`text-sm space-y-1 ${
                                        poll.poll_type === 'individual' 
                                            ? 'text-green-700' 
                                            : 'text-blue-700'
                                    }`}>
                                        {poll.poll_type === 'individual' ? (
                                            <>
                                                <p>• <strong>Participants:</strong> {poll.max_groups} individual slots</p>
                                                <p>• <strong>Format:</strong> Each person represents themselves</p>
                                                <p>• <strong>Voting:</strong> Vote for other participants (not yourself)</p>
                                            </>
                                        ) : (
                                            <>
                                                <p>• <strong>Groups:</strong> {poll.max_groups} teams of {poll.participants_per_group} members each</p>
                                                <p>• <strong>Total Capacity:</strong> {parseInt(poll.max_groups) * parseInt(poll.participants_per_group)} participants</p>
                                                <p>• <strong>Voting:</strong> Teams must be full before they can vote</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold mb-3">
                                        {poll.poll_type === 'individual' ? 'Participants' : 'Available Groups'}
                                    </h4>
                                    <div className="grid gap-3">
                                        {Array.from({ length: parseInt(poll.max_groups) }, (_, i) => {
                                            const groupId = i.toString();
                                            const group = poll.groups[groupId];
                                            const members = group?.members || [];
                                            const isFull = group?.is_full || false;
                                            const userInThisGroup = zkLoginAccountAddress && poll.user_to_group[zkLoginAccountAddress] === groupId;
                                            const userInAnyGroup = zkLoginAccountAddress && poll.user_to_group[zkLoginAccountAddress] !== undefined;
                                            
                                            // Group UI logic
                                            const groupExists = group !== undefined && (group.members.length > 0 || group.name !== '');
                                            const groupName = group?.name || '';
                                            const groupDescription = group?.description || '';
                                            const voteCount = poll.group_tally[groupId] || '0';
                                            
                                            // For individual polls, each "group" is one person
                                            const isIndividual = poll.poll_type === 'individual';
                                            const displayName = isIndividual 
                                                ? (groupName || `Slot ${i + 1}`)
                                                : (groupName || `Group ${i + 1}`);
                                            
                                            return (
                                                <div key={i} className="border rounded-lg p-3 bg-gray-50">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1 mr-3">
                                                            <h5 className="font-medium text-gray-900">{displayName}</h5>
                                                            {groupDescription && (
                                                                <p className="text-sm text-gray-700 mt-1 italic">"{groupDescription}"</p>
                                                            )}
                                                            {groupExists && !groupDescription && (
                                                                <p className="text-xs text-gray-500 mt-1">No description provided</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                                isFull ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {members.length}/{poll.participants_per_group} {isFull ? '✓ Ready' : 'Open'}
                                                            </span>
                                                            {voteCount !== '0' && (
                                                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                                                    {voteCount} votes
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                               
                                                               <div className="space-y-2">
                                                   {members.length > 0 ? (
                                                       <div className="text-sm text-gray-600">
                                                           <div className="font-medium mb-1">
                                                               {isIndividual ? 'Participant:' : `Members (${members.length}):`}
                                                           </div>
                                                           <div className="space-y-1">
                                                               {members.map((addr, idx) => (
                                                                   <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                                                       <div className="flex items-center gap-2">
                                                                           <code className="text-xs font-mono text-gray-800">
                                                                               {addr.slice(0, 10)}...{addr.slice(-8)}
                                                                           </code>
                                                                           <a 
                                                                               href={makePolymediaUrl("devnet", "address", addr)} 
                                                                               target="_blank" 
                                                                               rel="noopener noreferrer"
                                                                               className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-6 w-6 text-gray-400 hover:text-gray-600"
                                                                               title="View address on Explorer"
                                                                           >
                                                                               <ExternalLink className="h-3 w-3" />
                                                                           </a>
                                                                       </div>
                                                                       <div className="flex gap-1">
                                                                           {addr === group?.creator && (
                                                                               <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Creator</span>
                                                                           )}
                                                                           {addr === zkLoginAccountAddress && (
                                                                               <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">You</span>
                                                                           )}
                                                                       </div>
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
                                                                   
                                                    {!isPollArchived(poll) && !userInAnyGroup && !isFull && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleJoinGroupClick(poll.id, i, poll.poll_type, groupExists)}
                                                            disabled={isPending}
                                                            className="w-full"
                                                        >
                                                            {groupExists 
                                                                ? `+ Join ${displayName}`
                                                                : (isIndividual ? '+ Join as Individual' : '+ Create Group')
                                                            }
                                                        </Button>
                                                    )}
                                                    
                                                    {/* Voting buttons for dynamic polls */}
                                                    {!isPollArchived(poll) && userInAnyGroup && isFull && userInThisGroup && (
                                                        <div className="space-y-2">
                                                            <div className="text-xs text-blue-600 font-medium">
                                                                Vote for other {isIndividual ? 'participants' : 'groups'}:
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                {Array.from({ length: parseInt(poll.max_groups) }, (_, voteIdx) => {
                                                                    const targetGroup = poll.groups[voteIdx.toString()];
                                                                    const canVoteFor = targetGroup && targetGroup.is_full && voteIdx !== i;
                                                                    const targetName = targetGroup?.name || (isIndividual ? `Participant ${voteIdx + 1}` : `Group ${voteIdx + 1}`);
                                                                    
                                                                    if (!canVoteFor) return null;
                                                                    
                                                                    return (
                                                                        <Button
                                                                            key={voteIdx}
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => handleVoteForGroup(poll.id, voteIdx)}
                                                                            disabled={isPending}
                                                                            className="text-xs"
                                                                        >
                                                                            Vote {targetName}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
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

                            {/* Results section for archived dynamic polls */}
                            {isPollArchived(poll) && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                                    <h4 className="font-semibold text-gray-800 mb-3">📊 Final Results</h4>
                                    <div className="space-y-2">
                                        {Array.from({ length: parseInt(poll.max_groups) }, (_, i) => {
                                            const group = poll.groups[i.toString()];
                                            const voteCount = parseInt(poll.group_tally[i.toString()] || '0');
                                            const isIndividual = poll.poll_type === 'individual';
                                            
                                            if (!group || group.members.length === 0) return null;
                                            
                                            return (
                                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded border">
                                                    <div>
                                                        <div className="font-medium">
                                                            {group.name || (isIndividual ? `Participant ${i + 1}` : `Group ${i + 1}`)}
                                                        </div>
                                                        {group.description && (
                                                            <div className="text-sm text-gray-600">{group.description}</div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-lg text-blue-600">{voteCount}</div>
                                                        <div className="text-xs text-gray-500">votes</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                                        <div key={projectId} className="flex-1 flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleVote(poll.id, projectId)}
                                                disabled={isPending || isPollArchived(poll)}
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
                                            <a 
                                                href={makePolymediaUrl("devnet", "object", projectId)} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-gray-500 hover:text-gray-700"
                                                title="View project on Explorer"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Results section for archived regular polls */}
                            {isPollArchived(poll) && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                                    <h4 className="font-semibold text-gray-800 mb-3">📊 Final Results</h4>
                                    <div className="space-y-2">
                                        {poll.choices.map((projectId) => {
                                            const project = projects[projectId];
                                            const voteCount = parseInt(poll.tally[projectId] || '0');
                                            
                                            return (
                                                <div key={projectId} className="flex items-center justify-between p-3 bg-white rounded border">
                                                    <div>
                                                        <div className="font-medium">
                                                            {project?.name || `Project ${projectId.slice(0, 8)}...`}
                                                        </div>
                                                        {project?.description && (
                                                            <div className="text-sm text-gray-600">{project.description}</div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-lg text-blue-600">{voteCount}</div>
                                                        <div className="text-xs text-gray-500">votes</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                            </>
                        )}
                    </CardContent>
                </Card>
                ))
            )}
            
            <GroupNameDialog
                isOpen={showGroupDialog}
                onClose={() => {
                    setShowGroupDialog(false);
                    setSelectedPoll(null);
                }}
                onConfirm={handleGroupNameConfirm}
                pollType={selectedPoll?.pollType || 'group'}
            />
        </div>
    );
}
