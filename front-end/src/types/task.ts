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
  completed?: boolean;
}

export interface TaskFormData {
  task: string;
  description: string;
  category: string;
  urgency: 'low' | 'standard' | 'high' | 'urgent';
  estimated_duration: string;
  reward_amount: string;
}
