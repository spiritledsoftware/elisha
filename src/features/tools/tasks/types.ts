/** Result from task_create, task_output, and related task tools */
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
      agent?: string;
      title?: string;
      error: string;
      code:
        | 'AGENT_NOT_FOUND'
        | 'SESSION_ERROR'
        | 'CANCELLED'
        | 'TIMEOUT'
        | 'UNKNOWN_ERROR';
    }
  | {
      status: 'running';
      task_id: string;
      agent: string;
      title: string;
      partialResult?: string;
    }
  | {
      status: 'cancelled';
      task_id: string;
    };

// =============================================================================
// Broadcast Types
// =============================================================================

/** Category of broadcast message */
export type BroadcastCategory = 'discovery' | 'warning' | 'context' | 'blocker';

/** Target audience for broadcasts */
export type BroadcastTarget = 'all' | 'children' | 'siblings';

/** Source of broadcasts when reading */
export type BroadcastSource = 'self' | 'children';

/** Parsed broadcast from session messages */
export type Broadcast = {
  /** Agent ID (e.g., "Caleb (explorer)") */
  from: string;
  /** Source task session ID */
  task_id: string;
  /** Category of the broadcast */
  category: BroadcastCategory;
  /** ISO timestamp of when the broadcast was sent */
  timestamp: string;
  /** Broadcast content */
  message: string;
  /** Where this broadcast was found (for reads) */
  source?: 'self' | 'child';
};

/** Result from task_broadcast tool */
export type BroadcastResult =
  | {
      status: 'success';
      /** Count of recipients that received the broadcast */
      delivered_to: number;
      /** Count of recipients skipped (e.g., self) */
      skipped: number;
      /** Target audience that was broadcast to */
      target: BroadcastTarget;
    }
  | {
      status: 'partial';
      /** Count of recipients that received the broadcast */
      delivered_to: number;
      /** Count of recipients skipped (e.g., self) */
      skipped: number;
      /** Target audience that was broadcast to */
      target: BroadcastTarget;
      /** Delivery errors encountered */
      errors: string[];
    }
  | {
      status: 'failed';
      /** Target audience that was attempted */
      target: BroadcastTarget;
      /** Error message describing the failure */
      error: string;
    };

/** Result from task_broadcasts_read tool */
export type BroadcastsReadResult = {
  /** Array of parsed broadcasts */
  broadcasts: Broadcast[];
  /** Total number of broadcasts available */
  total: number;
  /** Source from which broadcasts were read */
  source: BroadcastSource;
};
