export type ProjectId = string;        // or number
export type TeamId = number;

export interface PollSummary {
  id: string;
  name: string;
  description?: string;
  deadlineMs: number;
  finalized: boolean;
}

export interface PollDetail extends PollSummary {
  choices: { projectId: ProjectId; name: string; teamId?: TeamId }[];
  tally: Record<ProjectId, number>;
}

export interface RegisterTeamPayload {
  pollId: string;
  teamId: TeamId;
  projectId: ProjectId;
  memberIdentifiers: { provider: 'google'|'apple'|'microsoft'|'edu'; idToken?: string; email?: string }[]; // 4 entries
}

export interface VoteRequest {
  pollId: string;
  projectId: ProjectId;
  // Frontend includes ephemeral public key / any zkLogin browser bits as needed:
  ephemeralPublicKey?: string;
}

export interface ApiSuccess<T=unknown> { ok: true; data: T; }
export interface ApiError { ok: false; error: string; }
