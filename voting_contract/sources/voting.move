#[allow(duplicate_alias)]
module voting::voting {
    use std::option::{Self, Option};
    use std::string::String;
    use std::vector;

    use sui::clock::{Clock};
    use sui::event;
    use sui::object::{ID, UID};
    use sui::table::{Table};
    use sui::transfer;
    use sui::tx_context::{TxContext};

    // --- Errors ---
    const E_ALREADY_VOTED: u64 = 1;
    const E_SELF_VOTE: u64 = 2;
    const E_BAD_CHOICE: u64 = 3;
    const E_TEAM_LIMIT_REACHED: u64 = 4;
    const E_CLOSED: u64 = 5;
    const E_FINALIZED: u64 = 6;
    const E_NOT_MEMBER: u64 = 7;
    const E_REGISTER_SIZE: u64 = 8;
    const E_PROJECT_ALREADY_SET: u64 = 9;
    const E_NOT_AUTHORIZED: u64 = 10;
    // Group-related errors
    const E_GROUPS_NOT_ENABLED: u64 = 11;
    const E_GROUP_FULL: u64 = 12;
    const E_ALREADY_IN_GROUP: u64 = 13;
    const E_GROUP_NOT_FULL: u64 = 14;
    const E_VOTE_OWN_GROUP: u64 = 15;
    const E_INVALID_GROUP: u64 = 16;

    // --- Objects & Structs ---
    public struct AdminCap has key {
        id: UID,
    }

    public struct RegistrarCap has key {
        id: UID,
    }

    public struct FinalizerCap has key {
        id: UID,
        poll_id: ID,
    }

    public struct Registry has key {
        id: UID,
        paused: bool,
        member_to_team: Table<vector<u8>, u64>,
        project_to_team: Table<ID, u64>,
        team_vote_count: Table<u64, u8>,
        used_nullifiers: Table<vector<u8>, bool>,
    }

    // New: Global registry to track all polls
    public struct PollRegistry has key {
        id: UID,
        polls: vector<ID>, // List of all poll IDs
    }

    public struct Project has key {
        id: UID,
        name: String,
        description: String,
    }

    public struct Poll has key {
        id: UID,
        name: String,
        description: String,
        choices: vector<ID>, // Will be empty for dynamic polls
        deadline_ms: u64,
        finalized: bool,
        tally: Table<ID, u64>, // For static polls
        // Group-based voting fields
        groups_enabled: bool,
        poll_type: String, // "individual" or "group"
        max_groups: u64,
        participants_per_group: u64,
        groups: Table<u64, Group>, // group_id -> Group
        user_to_group: Table<address, u64>, // user -> group_id
        group_tally: Table<u64, u64>, // For dynamic polls: group_id -> vote_count
    }

    // New: Group structure for team-based voting
    public struct Group has store {
        id: u64,
        name: String,
        description: String,
        members: vector<address>,
        is_full: bool,
        creator: address, // First person who joined and named the group
    }

    // --- Events ---
    public struct TeamRegistered has copy, drop, store {
        team: u64,
        project: ID,
    }

    public struct VoteCast has copy, drop, store {
        poll: ID,
        voter_team: u64,
        project: ID,
        new_tally_for_project: u64,
        team_votes_used: u8,
    }

    public struct Finalized has copy, drop, store {
        poll: ID,
        at_ms: u64,
    }

    // New: Group-related events
    public struct GroupJoined has copy, drop, store {
        poll: ID,
        user: address,
        group_id: u64,
        group_size: u64,
        is_full: bool,
    }

    public struct GroupVoteCast has copy, drop, store {
        poll: ID,
        voter: address,
        voter_group: u64,
        target_choice: ID,
        new_tally: u64,
    }

    // --- Functions ---
    fun init(ctx: &mut TxContext) {
        let reg = Registry {
            id: sui::object::new(ctx),
            paused: false,
            member_to_team: sui::table::new(ctx),
            project_to_team: sui::table::new(ctx),
            team_vote_count: sui::table::new(ctx),
            used_nullifiers: sui::table::new(ctx),
        };
        transfer::share_object(reg);

        // Create global poll registry
        let poll_registry = PollRegistry {
            id: sui::object::new(ctx),
            polls: vector::empty<ID>(),
        };
        transfer::share_object(poll_registry);

        let admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(admin, sui::tx_context::sender(ctx));
    }

    public fun mint_registrar_cap(_admin: &AdminCap, ctx: &mut TxContext) {
        let cap = RegistrarCap { id: sui::object::new(ctx) };
        transfer::transfer(cap, sui::tx_context::sender(ctx));
    }

    public fun mint_finalizer_cap(_admin: &AdminCap, poll: &Poll, ctx: &mut TxContext) {
        let cap = FinalizerCap { id: sui::object::new(ctx), poll_id: sui::object::id(poll) };
        transfer::transfer(cap, sui::tx_context::sender(ctx));
    }

    // Create a project that can be used as a poll choice
    public entry fun create_project(
        name: String,
        description: String,
        ctx: &mut TxContext
    ) {
        let project = Project {
            id: sui::object::new(ctx),
            name,
            description,
        };
        transfer::share_object(project);
    }

    // Simple test function for zkLogin debugging
    public entry fun test_simple_call(
        _admin: &AdminCap,
        test_message: String,
        _ctx: &mut TxContext
    ) {
        // This function does nothing but validate the AdminCap and accept a string
        // It's for testing transaction construction with zkLogin
        let _ = test_message; // Suppress unused variable warning
    }

    // Simplified version for testing - creates a poll with just two fixed choices
    public entry fun create_simple_poll(
        poll_registry: &mut PollRegistry,
        name: String,
        description: String,
        choice1: ID,
        choice2: ID,
        deadline_ms: u64,
        ctx: &mut TxContext
    ) {
        let mut choices = vector::empty<ID>();
        vector::push_back(&mut choices, choice1);
        vector::push_back(&mut choices, choice2);

        let mut tally = sui::table::new(ctx);
        sui::table::add(&mut tally, choice1, 0);
        sui::table::add(&mut tally, choice2, 0);

        let poll = Poll {
            id: sui::object::new(ctx),
            name,
            description,
            choices,
            deadline_ms,
            finalized: false,
            tally,
            // No groups for simple polls
            groups_enabled: false,
            poll_type: std::string::utf8(b"simple"),
            max_groups: 0,
            participants_per_group: 0,
            groups: sui::table::new(ctx),
            user_to_group: sui::table::new(ctx),
            group_tally: sui::table::new(ctx),
        };
        
        let poll_id = sui::object::id(&poll);
        
        // Register the poll in the global registry
        vector::push_back(&mut poll_registry.polls, poll_id);
        
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
    }

    public entry fun create_poll(
        poll_registry: &mut PollRegistry,
        name: String,
        description: String,
        choices: vector<ID>,
        deadline_ms: u64,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&choices) > 0, E_BAD_CHOICE);

        let mut tally = sui::table::new(ctx);
        let mut i = 0;
        while (i < vector::length(&choices)) {
            let pid = *vector::borrow(&choices, i);
            sui::table::add(&mut tally, pid, 0);
            i = i + 1;
        };

        let poll = Poll {
            id: sui::object::new(ctx),
            name,
            description,
            choices,
            deadline_ms,
            finalized: false,
            tally,
            // No groups for simple polls
            groups_enabled: false,
            poll_type: std::string::utf8(b"simple"),
            max_groups: 0,
            participants_per_group: 0,
            groups: sui::table::new(ctx),
            user_to_group: sui::table::new(ctx),
            group_tally: sui::table::new(ctx),
        };
        
        let poll_id = sui::object::id(&poll);
        
        // Register the poll in the global registry
        vector::push_back(&mut poll_registry.polls, poll_id);
        
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
    }

    // Create a poll with group-based voting
    public entry fun create_group_poll(
        poll_registry: &mut PollRegistry,
        name: String,
        description: String,
        choice1: ID,
        choice2: ID,
        deadline_ms: u64,
        max_groups: u64,
        participants_per_group: u64,
        ctx: &mut TxContext
    ) {
        let mut choices = vector::empty<ID>();
        vector::push_back(&mut choices, choice1);
        vector::push_back(&mut choices, choice2);

        let mut tally = sui::table::new(ctx);
        sui::table::add(&mut tally, choice1, 0);
        sui::table::add(&mut tally, choice2, 0);

        let poll = Poll {
            id: sui::object::new(ctx),
            name,
            description,
            choices,
            deadline_ms,
            finalized: false,
            tally,
            // Group-based voting setup
            groups_enabled: true,
            poll_type: std::string::utf8(b"group"),
            max_groups,
            participants_per_group,
            groups: sui::table::new(ctx),
            user_to_group: sui::table::new(ctx),
            group_tally: sui::table::new(ctx),
        };
        
        let poll_id = sui::object::id(&poll);
        
        // Register the poll in the global registry
        vector::push_back(&mut poll_registry.polls, poll_id);
        
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
    }

    // Create a dynamic poll (group-based or individual)
    public entry fun create_dynamic_poll(
        poll_registry: &mut PollRegistry,
        name: String,
        description: String,
        deadline_ms: u64,
        poll_type: String, // "individual" or "group"
        max_groups: u64,
        participants_per_group: u64,
        ctx: &mut TxContext
    ) {
        let poll = Poll {
            id: sui::object::new(ctx),
            name,
            description,
            choices: vector::empty<ID>(), // No predefined choices
            deadline_ms,
            finalized: false,
            tally: sui::table::new(ctx), // Empty for dynamic polls
            // Group-based voting setup
            groups_enabled: true,
            poll_type,
            max_groups,
            participants_per_group,
            groups: sui::table::new(ctx),
            user_to_group: sui::table::new(ctx),
            group_tally: sui::table::new(ctx), // For voting on groups
        };
        
        let poll_id = sui::object::id(&poll);
        
        // Register the poll in the global registry
        vector::push_back(&mut poll_registry.polls, poll_id);
        
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
    }

    // Get all poll IDs from the registry
    public fun get_all_polls(poll_registry: &PollRegistry): vector<ID> {
        poll_registry.polls
    }

    // Get the number of polls in the registry
    public fun get_poll_count(poll_registry: &PollRegistry): u64 {
        vector::length(&poll_registry.polls)
    }

    // Join a group in a poll with optional naming
    public entry fun join_group_with_name(
        poll: &mut Poll,
        group_id: u64,
        group_name: String,
        group_description: String,
        ctx: &mut TxContext
    ) {
        assert!(poll.groups_enabled, E_GROUPS_NOT_ENABLED);
        assert!(!poll.finalized, E_FINALIZED);
        
        let user = sui::tx_context::sender(ctx);
        
        // Check if user is already in a group
        assert!(!sui::table::contains(&poll.user_to_group, user), E_ALREADY_IN_GROUP);
        
        // Check if group_id is valid
        assert!(group_id < poll.max_groups, E_INVALID_GROUP);
        
        // Create group if it doesn't exist
        if (!sui::table::contains(&poll.groups, group_id)) {
            let new_group = Group {
                id: group_id,
                name: group_name,
                description: group_description,
                members: vector::empty<address>(),
                is_full: false,
                creator: user,
            };
            sui::table::add(&mut poll.groups, group_id, new_group);
        };
        
        let group = sui::table::borrow_mut(&mut poll.groups, group_id);
        
        // Check if group is full
        assert!(!group.is_full, E_GROUP_FULL);
        
        // Add user to group
        vector::push_back(&mut group.members, user);
        
        // Check if group is now full
        let group_size = vector::length(&group.members);
        let is_full = group_size == poll.participants_per_group;
        if (is_full) {
            group.is_full = true;
        };
        
        // Add user to poll's user mapping (after we're done with group)
        sui::table::add(&mut poll.user_to_group, user, group_id);
        
        // Emit event
        let poll_id = sui::object::id(poll);
        event::emit(GroupJoined {
            poll: poll_id,
            user,
            group_id,
            group_size,
            is_full,
        });
    }

    // Join an existing group (legacy function)
    public entry fun join_group(
        poll: &mut Poll,
        group_id: u64,
        ctx: &mut TxContext
    ) {
        join_group_with_name(poll, group_id, std::string::utf8(b""), std::string::utf8(b""), ctx);
    }

    // Vote for a choice as a group member
    public entry fun group_vote(
        poll: &mut Poll,
        choice_id: ID,
        ctx: &mut TxContext
    ) {
        assert!(poll.groups_enabled, E_GROUPS_NOT_ENABLED);
        assert!(!poll.finalized, E_FINALIZED);
        
        let user = sui::tx_context::sender(ctx);
        
        // Check if user is in a group
        assert!(sui::table::contains(&poll.user_to_group, user), E_NOT_MEMBER);
        
        let user_group_id = *sui::table::borrow(&poll.user_to_group, user);
        let group = sui::table::borrow(&poll.groups, user_group_id);
        
        // Check if group is full (can vote)
        assert!(group.is_full, E_GROUP_NOT_FULL);
        
        // Check if choice is valid
        assert!(vector::contains(&poll.choices, &choice_id), E_BAD_CHOICE);
        
        // Update tally
        let current_tally = *sui::table::borrow(&poll.tally, choice_id);
        let new_tally = current_tally + 1;
        *sui::table::borrow_mut(&mut poll.tally, choice_id) = new_tally;
        
        // Emit event
        let poll_id = sui::object::id(poll);
        event::emit(GroupVoteCast {
            poll: poll_id,
            voter: user,
            voter_group: user_group_id,
            target_choice: choice_id,
            new_tally,
        });
    }

    // Vote for a group in dynamic polls
    public entry fun vote_for_group(
        poll: &mut Poll,
        target_group_id: u64,
        ctx: &mut TxContext
    ) {
        assert!(poll.groups_enabled, E_GROUPS_NOT_ENABLED);
        assert!(!poll.finalized, E_FINALIZED);
        
        let user = sui::tx_context::sender(ctx);
        
        // Check if user is in a group
        assert!(sui::table::contains(&poll.user_to_group, user), E_NOT_MEMBER);
        
        let user_group_id = *sui::table::borrow(&poll.user_to_group, user);
        let user_group = sui::table::borrow(&poll.groups, user_group_id);
        
        // Check if user's group is full (can vote)
        assert!(user_group.is_full, E_GROUP_NOT_FULL);
        
        // Check if target group exists
        assert!(sui::table::contains(&poll.groups, target_group_id), E_INVALID_GROUP);
        
        // Can't vote for your own group (for group-based polls)
        if (poll.poll_type == std::string::utf8(b"group")) {
            assert!(user_group_id != target_group_id, E_VOTE_OWN_GROUP);
        };
        
        // Update group tally
        if (sui::table::contains(&poll.group_tally, target_group_id)) {
            let current_votes = sui::table::borrow_mut(&mut poll.group_tally, target_group_id);
            *current_votes = *current_votes + 1;
        } else {
            sui::table::add(&mut poll.group_tally, target_group_id, 1);
        };
        
        // Emit event (reusing GroupVoteCast for now)
        let poll_id = sui::object::id(poll);
        event::emit(GroupVoteCast {
            poll: poll_id,
            voter: user,
            voter_group: user_group_id,
            target_choice: sui::object::id_from_address(@0x0), // Placeholder
            new_tally: *sui::table::borrow(&poll.group_tally, target_group_id),
        });
    }

    public fun register_team(
        _rcap: &RegistrarCap,
        reg: &mut Registry,
        poll: &Poll,
        team: u64,
        project: ID,
        members_4: vector<vector<u8>>,
    ) {
        assert!(vector::length(&members_4) == 4, E_REGISTER_SIZE);
        assert!(is_choice(poll, project), E_BAD_CHOICE);
        assert!(!sui::table::contains(&reg.project_to_team, project), E_PROJECT_ALREADY_SET);
        sui::table::add(&mut reg.project_to_team, project, team);

        if (!sui::table::contains(&reg.team_vote_count, team)) {
            sui::table::add(&mut reg.team_vote_count, team, 0);
        };

        let mut i = 0;
        while (i < 4) {
            let n = *vector::borrow(&members_4, i);
            assert!(!sui::table::contains(&reg.member_to_team, n), E_NOT_AUTHORIZED);
            sui::table::add(&mut reg.member_to_team, n, team);
            i = i + 1;
        };

        event::emit(TeamRegistered { team, project });
    }

    public fun cast_vote(
        reg: &mut Registry,
        poll: &mut Poll,
        voter_nullifier_hash: vector<u8>,
        project: ID,
        clk: &Clock
    ) {
        assert!(!poll.finalized, E_FINALIZED);
        assert!(sui::clock::timestamp_ms(clk) < poll.deadline_ms, E_CLOSED);
        assert!(sui::table::contains(&reg.member_to_team, voter_nullifier_hash), E_NOT_MEMBER);
        assert!(is_choice(poll, project), E_BAD_CHOICE);
        assert!(!sui::table::contains(&reg.used_nullifiers, voter_nullifier_hash), E_ALREADY_VOTED);

        let voter_team = *sui::table::borrow(&reg.member_to_team, voter_nullifier_hash);
        let project_team = *sui::table::borrow(&reg.project_to_team, project);

        assert!(voter_team != project_team, E_SELF_VOTE);

        let votes_used = get_or_zero(&reg.team_vote_count, voter_team);
        assert!(votes_used < 4, E_TEAM_LIMIT_REACHED);

        sui::table::add(&mut reg.used_nullifiers, voter_nullifier_hash, true);
        upsert_u8_plus_one(&mut reg.team_vote_count, voter_team);
        upsert_u64_plus_one(&mut poll.tally, project);

        let new_tally = *sui::table::borrow(&poll.tally, project);
        let team_votes = *sui::table::borrow(&reg.team_vote_count, voter_team);

        event::emit(VoteCast {
            poll: sui::object::id(poll),
            voter_team,
            project,
            new_tally_for_project: new_tally,
            team_votes_used: team_votes,
        });
    }

    public fun finalize_with_admin(_admin: &AdminCap, poll: &mut Poll, clk: &Clock) {
        finalize_inner(poll, clk);
    }

    public fun finalize_with_cap(fcap: &FinalizerCap, poll: &mut Poll, clk: &Clock) {
        assert!(fcap.poll_id == sui::object::id(poll), E_NOT_AUTHORIZED);
        finalize_inner(poll, clk);
    }

    fun finalize_inner(poll: &mut Poll, clk: &Clock) {
        assert!(!poll.finalized, E_FINALIZED);
        let now = sui::clock::timestamp_ms(clk);
        poll.finalized = true;
        event::emit(Finalized { poll: sui::object::id(poll), at_ms: now });
    }

    fun is_choice(poll: &Poll, p: ID): bool {
        vector::contains(&poll.choices, &p)
    }

    fun get_or_zero(t: &Table<u64, u8>, key: u64): u8 {
        if (sui::table::contains(t, key)) {
            *sui::table::borrow(t, key)
        } else {
            0
        }
    }

    fun upsert_u8_plus_one(t: &mut Table<u64, u8>, key: u64) {
        if (sui::table::contains(t, key)) {
            let r = sui::table::borrow_mut(t, key);
            *r = *r + 1;
        } else {
            sui::table::add(t, key, 1);
        }
    }

    fun upsert_u64_plus_one(t: &mut Table<ID, u64>, key: ID) {
        if (sui::table::contains(t, key)) {
            let r = sui::table::borrow_mut(t, key);
            *r = *r + 1;
        } else {
            sui::table::add(t, key, 1);
        }
    }

    // Get group members (returns up to first 10 members for display)
    public fun get_group_members(poll: &Poll, group_id: u64): vector<address> {
        if (sui::table::contains(&poll.groups, group_id)) {
            let group = sui::table::borrow(&poll.groups, group_id);
            // Return first 10 members to avoid gas issues
            let members = &group.members;
            let len = vector::length(members);
            if (len <= 10) {
                *members
            } else {
                let mut result = vector::empty<address>();
                let mut i = 0;
                while (i < 10) {
                    vector::push_back(&mut result, *vector::borrow(members, i));
                    i = i + 1;
                };
                result
            }
        } else {
            vector::empty<address>()
        }
    }

    // Get user's group ID in a poll
    public fun get_user_group_id(poll: &Poll, user: address): u64 {
        if (sui::table::contains(&poll.user_to_group, user)) {
            *sui::table::borrow(&poll.user_to_group, user)
        } else {
            999 // Return 999 if user not in any group
        }
    }
}
