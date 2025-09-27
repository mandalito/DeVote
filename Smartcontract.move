module voting::voting {
    use std::string;
    use std::vector;

    use sui::clock::{Self as clock, Clock};
    use sui::event;
    use sui::object::{Self as object, UID, ID};
    use sui::table::{Self as table, Table};
    use sui::transfer;
    use sui::tx_context::{Self as tx_context, TxContext};

    /// ------------ Type aliases ------------
    /// Team identifier (off-chain assigned, simple u64 is enough)
    public type TeamId = u64;
    /// Project identifier (the on-chain Object ID of that project's object/placeholder)
    public type ProjectId = ID;
    /// Nullifier hash (already hashed off-chain; we only store the bytes)
    public type NullifierHash = vector<u8>;

    /// ------------ Errors ------------
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

    /// ------------ Capability objects (access control) ------------
    struct AdminCap has key {
        id: UID,
    }

    /// Can register teams for a poll.
    struct RegistrarCap has key {
        id: UID,
    }

    /// Can finalize a specific poll.
    struct FinalizerCap has key {
        id: UID,
        poll_id: ID,
    }

    /// ------------ Global Registry (shared singleton) ------------
    ///
    /// Holds global mappings that enforce:
    ///  - member nullifier -> team id
    ///  - project id -> team id (for self-vote ban)
    ///  - team vote count (0..4 cap)
    ///  - used nullifier hashes (one-vote-per-member)
    struct Registry has key {
        id: UID,
        paused: bool,

        member_to_team: Table<NullifierHash, TeamId>,
        project_to_team: Table<ProjectId, TeamId>,
        team_vote_count: Table<TeamId, u8>,
        used_nullifiers: Table<NullifierHash, bool>,
    }

    /// ------------ Poll object (shared) ------------
    ///
    /// A single voting event.
    struct Poll has key {
        id: UID,
        name: string::String,
        description: string::String,
        choices: vector<ProjectId>,
        deadline_ms: u64,
        finalized: bool,
        tally: Table<ProjectId, u64>,
    }

    /// ------------ Events ------------
    struct TeamRegistered has copy, drop, store {
        team: TeamId,
        project: ProjectId,
    }

    struct VoteCast has copy, drop, store {
        poll: ID,
        voter_team: TeamId,
        project: ProjectId,
        new_tally_for_project: u64,
        team_votes_used: u8, // 1..4
    }

    struct Finalized has copy, drop, store {
        poll: ID,
        at_ms: u64,
    }

    /// =========================================
    /// ============= Init & Admin ===============
    /// =========================================

    /// Publish the global Registry (shared) and hand an AdminCap to the sender.
    public entry fun init(ctx: &mut TxContext) {
        // Create and share the singleton Registry
        let reg = Registry {
            id: object::new(ctx),
            paused: false,
            member_to_team: table::new<NullifierHash, TeamId>(),
            project_to_team: table::new<ProjectId, TeamId>(),
            team_vote_count: table::new<TeamId, u8>(),
            used_nullifiers: table::new<NullifierHash, bool>(),
        };
        transfer::share_object(reg);

        // Mint AdminCap to the publisher/sender
        let admin = AdminCap { id: object::new(ctx) };
        let sender = tx_context::sender(ctx);
        transfer::transfer(admin, sender);
    }

    /// Mint a RegistrarCap (authorized by AdminCap).
    public entry fun mint_registrar_cap(_admin: &AdminCap, ctx: &mut TxContext) {
        let cap = RegistrarCap { id: object::new(ctx) };
        let to = tx_context::sender(ctx);
        transfer::transfer(cap, to);
    }

    /// Mint a FinalizerCap bound to a poll (authorized by AdminCap).
    public entry fun mint_finalizer_cap(_admin: &AdminCap, poll: &Poll, ctx: &mut TxContext) {
        let cap = FinalizerCap { id: object::new(ctx), poll_id: object::id(poll) };
        let to = tx_context::sender(ctx);
        transfer::transfer(cap, to);
    }

    /// Create a new Poll and share it.
    public entry fun create_poll(
        _admin: &AdminCap,
        name: string::String,
        description: string::String,
        choices: vector<ProjectId>,
        deadline_ms: u64,
        ctx: &mut TxContext
    ) {
        // Basic sanity
        assert!(vector::length<ProjectId>(&choices) > 0, E_BAD_CHOICE);

        let tally = table::new<ProjectId, u64>();
        // Initialize all project tallies with 0
        let i = 0;
        while (i < vector::length<ProjectId>(&choices)) {
            let pid = *vector::borrow<ProjectId>(&choices, i);
            table::add<ProjectId, u64>(&mut tally, pid, 0);
            i = i + 1;
        };

        let poll = Poll {
            id: object::new(ctx),
            name,
            description,
            choices,
            deadline_ms,
            finalized: false,
            tally,
        };
        transfer::share_object(poll);
    }

    /// =========================================
    /// ============== Registration =============
    /// =========================================

    /// Register a team with exactly 4 member nullifier hashes and map its project.
    /// Enforces:
    ///  - exactly 4 members
    ///  - project -> team unique
    ///  - each member nullifier is fresh (not previously mapped)
    ///  - project must be in this poll's choices
    public entry fun register_team(
        _rcap: &RegistrarCap,
        reg: &mut Registry,
        poll: &Poll,
        team: TeamId,
        project: ProjectId,
        members_4: vector<NullifierHash>,
    ) {
        // Exactly 4 members required
        assert!(vector::length<NullifierHash>(&members_4) == 4, E_REGISTER_SIZE);

        // Project must be in poll choices
        assert!(is_choice(poll, &project), E_BAD_CHOICE);

        // project must not already be mapped
        assert!(!table::contains<ProjectId, TeamId>(&reg.project_to_team, &project), E_PROJECT_ALREADY_SET);
        table::add<ProjectId, TeamId>(&mut reg.project_to_team, project, team);

        // initialize team vote count to 0 (idempotent add)
        if (!table::contains<TeamId, u8>(&reg.team_vote_count, &team)) {
            table::add<TeamId, u8>(&mut reg.team_vote_count, team, 0);
        };

        // Map each member's nullifier -> team (each must be unused)
        let i = 0;
        while (i < 4) {
            let nref = vector::borrow<NullifierHash>(&members_4, i);
            let n = copy *nref;
            assert!(!table::contains<NullifierHash, TeamId>(&reg.member_to_team, &n), E_NOT_AUTHORIZED);
            table::add<NullifierHash, TeamId>(&mut reg.member_to_team, n, team);
            i = i + 1;
        };

        event::emit(TeamRegistered { team, project });
    }

    /// =========================================
    /// ================= Voting =================
    /// =========================================

    /// Cast a vote from a registered member (by nullifier hash) to a project.
    /// Checks:
    ///  - poll not finalized, before deadline
    ///  - member registered (nullifier -> team exists)
    ///  - nullifier not used before (one vote per member)
    ///  - project is a valid choice in this poll
    ///  - self-vote ban (voter_team != project_team)
    ///  - team vote cap < 4
    public entry fun cast_vote(
        reg: &mut Registry,
        poll: &mut Poll,
        voter_nullifier_hash: NullifierHash,
        project: ProjectId,
        clk: &Clock
    ) {
        assert!(!poll.finalized, E_FINALIZED);
        let now = clock::now_millis(clk);
        assert!(now < poll.deadline_ms, E_CLOSED);

        // member must be registered
        assert!(table::contains<NullifierHash, TeamId>(&reg.member_to_team, &voter_nullifier_hash), E_NOT_MEMBER);
        // project must be a valid choice for this poll
        assert!(is_choice(&poll, &project), E_BAD_CHOICE);

        // one vote per member (nullifier gated)
        assert!(!table::contains<NullifierHash, bool>(&reg.used_nullifiers, &voter_nullifier_hash), E_ALREADY_VOTED);

        // identify teams
        let voter_team_ref = table::borrow<NullifierHash, TeamId>(&reg.member_to_team, &voter_nullifier_hash);
        let voter_team: TeamId = *voter_team_ref;

        let project_team_ref = table::borrow<ProjectId, TeamId>(&reg.project_to_team, &project);
        let project_team: TeamId = *project_team_ref;

        // self-vote ban
        assert!(voter_team != project_team, E_SELF_VOTE);

        // team vote cap: < 4
        let votes_used: u8 = get_or_zero<TeamId, u8>(&reg.team_vote_count, &voter_team);
        assert!((votes_used as u64) < 4, E_TEAM_LIMIT_REACHED);

        // mark nullifier used
        table::add<NullifierHash, bool>(&mut reg.used_nullifiers, voter_nullifier_hash, true);

        // increment team vote count
        upsert_u8_plus_one(&mut reg.team_vote_count, voter_team);

        // increment project tally
        upsert_u64_plus_one(&mut poll.tally, project);

        let new_tally = *table::borrow<ProjectId, u64>(&poll.tally, &project);
        let team_votes = *table::borrow<TeamId, u8>(&reg.team_vote_count, &voter_team);

        event::emit(VoteCast {
            poll: object::id(&poll),
            voter_team,
            project,
            new_tally_for_project: new_tally,
            team_votes_used: team_votes,
        });
    }

    /// Finalize the poll using an AdminCap (broad power).
    public entry fun finalize_with_admin(_admin: &AdminCap, poll: &mut Poll, clk: &Clock) {
        finalize_inner(poll, clk);
    }

    /// Finalize the poll using a scoped FinalizerCap (must match poll_id).
    public entry fun finalize_with_cap(fcap: &FinalizerCap, poll: &mut Poll, clk: &Clock) {
        assert!(fcap.poll_id == object::id(&poll), E_NOT_AUTHORIZED);
        finalize_inner(poll, clk);
    }

    fun finalize_inner(poll: &mut Poll, clk: &Clock) {
        assert!(!poll.finalized, E_FINALIZED);
        // Optional: you could enforce closing time here or allow early finalization.
        let _now = clock::now_millis(clk);
        poll.finalized = true;
        event::emit(Finalized { poll: object::id(&poll), at_ms: _now });
    }

    /// =========================================
    /// ============== Helpers ==================
    /// =========================================

    /// Check if a project is in poll.choices
    fun is_choice(poll: &Poll, p: &ProjectId): bool {
        let i = 0;
        while (i < vector::length<ProjectId>(&poll.choices)) {
            let v = vector::borrow<ProjectId>(&poll.choices, i);
            if (*v == *p) { return true }
            i = i + 1;
        };
        false
    }

    /// Read value or 0 for u8 table
    fun get_or_zero<K: copy + drop + store>(t: &Table<K, u8>, key: &K): u8 {
        if (table::contains<K, u8>(t, key)) {
            *table::borrow<K, u8>(t, key)
        } else {
            0
        }
    }

    /// Upsert +1 for u8 counters
    fun upsert_u8_plus_one<K: copy + drop + store>(t: &mut Table<K, u8>, key: K) {
        if (table::contains<K, u8>(t, &key)) {
            let r = table::borrow_mut<K, u8>(t, &key);
            *r = *r + 1;
        } else {
            table::add<K, u8>(t, key, 1);
        }
    }

    /// Upsert +1 for u64 counters
    fun upsert_u64_plus_one<K: copy + drop + store>(t: &mut Table<K, u64>, key: K) {
        if (table::contains<K, u64>(t, &key)) {
            let r = table::borrow_mut<K, u64>(t, &key);
            *r = *r + 1;
        } else {
            table::add<K, u64>(t, key, 1);
        }
    }
}
