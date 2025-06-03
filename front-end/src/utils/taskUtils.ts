import { Task, TASK_STATUS, TaskStatus } from '@/types/task';

/**
 * Utility functions for handling tasks with proper UUID management and status handling
 */

interface BackendTaskData {
  uuid?: string;
  id?: string;
  task: string;
  description: string;
  category: string;
  urgency: 'low' | 'standard' | 'high' | 'urgent';
  submitter: string;
  timestamp: string;
  estimated_duration: string;
  reward_amount: string;
  status?: TaskStatus;
  worker?: string;
  result?: string;
  completed?: boolean;
}

export const generateTaskUUID = (): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `job-${timestamp}-${randomSuffix}`;
};

export const parseTaskFromBackend = (backendData: BackendTaskData): Task => {
  // Handle the case where backend returns "uuid" as the key
  return {
    uuid: backendData.uuid || backendData.id || generateTaskUUID(),
    task: backendData.task,
    description: backendData.description,
    category: backendData.category,
    urgency: backendData.urgency,
    submitter: backendData.submitter,
    timestamp: backendData.timestamp,
    estimated_duration: backendData.estimated_duration,
    reward_amount: backendData.reward_amount,
    status: backendData.status ?? TASK_STATUS.PENDING, // Default to PENDING if not provided
    worker: backendData.worker,
    result: backendData.result,
    completed: backendData.completed || false
  };
};

export const formatTaskForBackend = (task: Task) => {
  // Ensure we use "uuid" as the key when sending to backend
  return {
    uuid: task.uuid,
    task: task.task,
    description: task.description,
    category: task.category,
    urgency: task.urgency,
    submitter: task.submitter,
    timestamp: task.timestamp,
    estimated_duration: task.estimated_duration,
    reward_amount: task.reward_amount,
    completed: task.completed
  };
};

export const validateTaskData = (task: Partial<Task>): string[] => {
  const errors: string[] = [];
  
  if (!task.task || task.task.trim() === '') {
    errors.push('Task name is required');
  }
  
  if (!task.description || task.description.trim() === '') {
    errors.push('Task description is required');
  }
  
  if (!task.category || task.category.trim() === '') {
    errors.push('Task category is required');
  }
  
  if (!task.estimated_duration || task.estimated_duration.trim() === '') {
    errors.push('Estimated duration is required');
  }
  
  if (!task.reward_amount || task.reward_amount.trim() === '') {
    errors.push('Reward amount is required');
  }
  
  if (!['low', 'standard', 'high', 'urgent'].includes(task.urgency || '')) {
    errors.push('Valid urgency level is required');
  }
  
  return errors;
};

export const sortTasks = (tasks: Task[], sortBy: 'timestamp' | 'urgency' | 'reward'): Task[] => {
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'timestamp':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'urgency': {
        const urgencyOrder = { urgent: 4, high: 3, standard: 2, low: 1 };
        return urgencyOrder[b.urgency as keyof typeof urgencyOrder] - urgencyOrder[a.urgency as keyof typeof urgencyOrder];
      }
      case 'reward': {
        const aAmount = parseFloat(a.reward_amount.replace(/[^\d.]/g, ''));
        const bAmount = parseFloat(b.reward_amount.replace(/[^\d.]/g, ''));
        return bAmount - aAmount;
      }
      default:
        return 0;
    }
  });
};

export const filterTasks = (tasks: Task[], filter: 'all' | 'active' | 'completed' | 'pending' | 'claimed'): Task[] => {
  switch (filter) {
    case 'active':
      // Active means not yet verified (PENDING, CLAIMED, COMPLETED)
      return tasks.filter(task => task.status < TASK_STATUS.VERIFIED);
    case 'completed':
      // Completed means verified (VERIFIED status)
      return tasks.filter(task => task.status === TASK_STATUS.VERIFIED);
    case 'pending':
      // Available for claiming
      return tasks.filter(task => task.status === TASK_STATUS.PENDING);
    case 'claimed':
      // Currently being worked on
      return tasks.filter(task => task.status === TASK_STATUS.CLAIMED);
    default:
      return tasks;
  }
};

export const getTaskStats = (tasks: Task[]) => {
  const total = tasks.length;
  // Use status-based calculations instead of legacy completed field
  const completed = tasks.filter(task => task.status === TASK_STATUS.VERIFIED).length;
  const active = tasks.filter(task => task.status < TASK_STATUS.VERIFIED).length;
  const pending = tasks.filter(task => task.status === TASK_STATUS.PENDING).length;
  const claimed = tasks.filter(task => task.status === TASK_STATUS.CLAIMED).length;
  const awaitingVerification = tasks.filter(task => task.status === TASK_STATUS.COMPLETED).length;

  const totalReward = tasks.reduce((sum, task) => {
    const amount = parseFloat(task.reward_amount.replace(/[^\d.]/g, ''));
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  return { 
    total, 
    completed, 
    active, 
    pending, 
    claimed, 
    awaitingVerification, 
    totalReward 
  };
};
