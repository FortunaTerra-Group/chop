export type RunState = 'idle' | 'running' | 'timed_out' | 'revoked';

export interface TransitionLogEntry {
  actor: string;
  before: RunState;
  after: RunState;
  timestamp: number;
}
