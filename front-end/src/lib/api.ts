import { Task } from '@/types/task';
import { taskAPI, WalletInfo } from './taskAPI';

/**
 * Legacy API functions that delegate to the new TaskAPI class
 * Maintained for backward compatibility
 */

export const fetchTasks = async (): Promise<Task[]> => {
  return await taskAPI.getAllTasks();
};

export const createTask = async (
  taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed' | 'status'>,
  walletInfo?: WalletInfo
): Promise<Task> => {
  return await taskAPI.createTask(taskData, walletInfo);
};

export const updateTaskStatus = async (uuid: string, completed: boolean): Promise<Task> => {
  return await taskAPI.updateTaskStatus(uuid, completed);
};

export const deleteTask = async (uuid: string): Promise<void> => {
  return await taskAPI.deleteTask(uuid);
};

// Export the enhanced API for new features
export { taskAPI };
