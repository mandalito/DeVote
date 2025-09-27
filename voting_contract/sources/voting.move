#[allow(duplicate_alias)]
module voting::voting {
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

    public struct Project has key {
        id: UID,
        name: String,
        description: String,
    }

    public struct Poll has key {
        id: UID,
        name: String,
        description: String,
        choices: vector<ID>,
        deadline_ms: u64,
        finalized: bool,
        tally: Table<ID, u64>,
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
        };
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
    }

    public entry fun create_poll(
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
        };
        transfer::share_object(poll);

        // Create a new AdminCap for this poll's creator
        let poll_admin = AdminCap { id: sui::object::new(ctx) };
        transfer::transfer(poll_admin, sui::tx_context::sender(ctx));
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
}
