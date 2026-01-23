export type TaskResult =
  | {
      status: 'completed';
      task_id: string;
      agent: string;
      title: string;
      result: string;
    }
  | {
      status: 'failed';
      task_id?: string;
      error: string;
      code: 'AGENT_NOT_FOUND' | 'SESSION_ERROR' | 'TIMEOUT' | 'CANCELLED';
    }
  | { status: 'running'; task_id: string; title: string }
  | { status: 'cancelled'; task_id: string };
