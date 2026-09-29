export type RunState = 'idle' | 'running' | 'timed_out';

export interface TransitionLogEntry {
  actor: string;
  before: RunState;
  after: RunState;
  timestamp: number;
}
