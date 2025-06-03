
export type TaskStatus = 0 | 1 | 2 | 3;

export const TASK_STATUS = {
  PENDING: 0 as TaskStatus,     // available for claiming
  CLAIMED: 1 as TaskStatus,     // worker assigned
  COMPLETED: 2 as TaskStatus,   // work done, pending verification
  VERIFIED: 3 as TaskStatus,    // payment released
} as const;

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.PENDING]: 'PENDING',
  [TASK_STATUS.CLAIMED]: 'CLAIMED',
  [TASK_STATUS.COMPLETED]: 'COMPLETED',
  [TASK_STATUS.VERIFIED]: 'VERIFIED',
} as const;

export interface Task {
  uuid: string;
  task: string;
  description: string;
  category: string;
  urgency: 'low' | 'standard' | 'high' | 'urgent';
  submitter: string;
  timestamp: string;
  estimated_duration: string;
  reward_amount: string;
  status: TaskStatus;
  result?: string; // Worker's result when status is COMPLETED
  worker?: string; // Worker's address when status is CLAIMED or COMPLETED
  completed?: boolean; // Legacy field, will be derived from status
}

export interface TaskFormData {
  task: string;
  description: string;
  category: string;
  urgency: 'low' | 'standard' | 'high' | 'urgent';
  estimated_duration: string;
  reward_amount: string;
}
