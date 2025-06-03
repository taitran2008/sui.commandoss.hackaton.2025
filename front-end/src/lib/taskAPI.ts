import { Task } from '@/types/task';
import { parseTaskFromBackend, formatTaskForBackend, generateTaskUUID } from '@/utils/taskUtils';
import { APP_CONFIG } from '@/config/app';

/**
 * Enhanced API utilities for backend integration with proper UUID handling
 */

export class TaskAPI {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = APP_CONFIG.api.baseUrl;
    this.timeout = APP_CONFIG.api.timeout;
  }

  /**
   * Fetch all tasks from the backend
   * Properly handles the 'uuid' field name from backend responses
   */
  async getAllTasks(): Promise<Task[]> {
    try {
      // In a real implementation, this would be:
      // const response = await fetch(`${this.baseUrl}/tasks`);
      // const data = await response.json();
      // return data.map(parseTaskFromBackend);

      // For now, return mock data with your exact format
      return this.getMockTasks();
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw new Error('Failed to fetch tasks');
    }
  }

  /**
   * Create a new task
   */
  async createTask(taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed'>): Promise<Task> {
    try {
      const newTask: Task = {
        ...taskData,
        uuid: generateTaskUUID(),
        timestamp: new Date().toISOString(),
        submitter: this.generateMockWalletAddress(),
        completed: false
      };

      // In a real implementation:
      // const response = await fetch(`${this.baseUrl}/tasks`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formatTaskForBackend(newTask))
      // });
      // const data = await response.json();
      // return parseTaskFromBackend(data);

      // For now, simulate API delay and return the task
      await this.simulateDelay(300);
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(uuid: string, completed: boolean): Promise<Task> {
    try {
      // In a real implementation:
      // const response = await fetch(`${this.baseUrl}/tasks/${uuid}`, {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ completed })
      // });
      // const data = await response.json();
      // return parseTaskFromBackend(data);

      await this.simulateDelay(200);
      
      // For demo purposes, return a mock updated task
      const mockTask: Task = {
        uuid,
        task: "updated-task",
        description: "Task status updated",
        category: "system",
        urgency: "standard",
        submitter: this.generateMockWalletAddress(),
        timestamp: new Date().toISOString(),
        estimated_duration: "0 minutes",
        reward_amount: "0 SUI",
        completed
      };

      return mockTask;
    } catch (error) {
      console.error('Error updating task:', error);
      throw new Error('Failed to update task');
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(uuid: string): Promise<void> {
    try {
      // In a real implementation:
      // await fetch(`${this.baseUrl}/tasks/${uuid}`, {
      //   method: 'DELETE'
      // });

      await this.simulateDelay(200);
      console.log(`Task ${uuid} deleted`);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error('Failed to delete task');
    }
  }

  /**
   * Search tasks by criteria
   */
  async searchTasks(query: string, filters?: {
    category?: string;
    urgency?: string;
    completed?: boolean;
  }): Promise<Task[]> {
    try {
      // In a real implementation:
      // const params = new URLSearchParams({ query, ...filters });
      // const response = await fetch(`${this.baseUrl}/tasks/search?${params}`);
      // const data = await response.json();
      // return data.map(parseTaskFromBackend);

      const allTasks = await this.getAllTasks();
      return allTasks.filter(task => {
        const matchesQuery = task.task.toLowerCase().includes(query.toLowerCase()) ||
                           task.description.toLowerCase().includes(query.toLowerCase());
        
        const matchesFilters = (!filters?.category || task.category === filters.category) &&
                              (!filters?.urgency || task.urgency === filters.urgency) &&
                              (filters?.completed === undefined || task.completed === filters.completed);
        
        return matchesQuery && matchesFilters;
      });
    } catch (error) {
      console.error('Error searching tasks:', error);
      throw new Error('Failed to search tasks');
    }
  }

  /**
   * Get task statistics
   */
  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    active: number;
    totalReward: number;
    avgCompletionTime?: number;
  }> {
    try {
      const tasks = await this.getAllTasks();
      const total = tasks.length;
      const completed = tasks.filter(task => task.completed).length;
      const active = total - completed;
      const totalReward = tasks.reduce((sum, task) => {
        const amount = parseFloat(task.reward_amount.replace(/[^\d.]/g, ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      return { total, completed, active, totalReward };
    } catch (error) {
      console.error('Error fetching task stats:', error);
      throw new Error('Failed to fetch task statistics');
    }
  }

  /**
   * Mock data that matches your exact backend format
   */
  private getMockTasks(): Task[] {
    return [
      {
        uuid: "job-1748762754972-duk1yulf34",
        task: "translation",
        description: "Translate 100 words into French",
        category: "language",
        urgency: "standard",
        submitter: "0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de",
        timestamp: "2025-06-01T07:25:54.972Z",
        estimated_duration: "30 minutes",
        reward_amount: "0.1 SUI",
        completed: false
      },
      {
        uuid: "job-1748762754973-xyz9abc123",
        task: "data-entry",
        description: "Enter customer information into database",
        category: "admin",
        urgency: "high",
        submitter: "0xbb59fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578df",
        timestamp: "2025-06-02T09:15:30.123Z",
        estimated_duration: "45 minutes",
        reward_amount: "0.2 SUI",
        completed: false
      },
      {
        uuid: "job-1748762754974-def456ghi7",
        task: "content-review",
        description: "Review and approve blog posts for publication",
        category: "content",
        urgency: "low",
        submitter: "0xcc69fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578e0",
        timestamp: "2025-06-01T14:20:15.456Z",
        estimated_duration: "60 minutes",
        reward_amount: "0.15 SUI",
        completed: true
      },
      {
        uuid: "job-1748762754975-mno789pqr2",
        task: "smart-contract-audit",
        description: "Security audit of SUI smart contract for DeFi protocol",
        category: "development",
        urgency: "urgent",
        submitter: "0xdd79fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578e1",
        timestamp: "2025-06-03T11:30:45.789Z",
        estimated_duration: "2 hours",
        reward_amount: "1.5 SUI",
        completed: false
      }
    ];
  }

  /**
   * Generate a mock SUI wallet address
   */
  private generateMockWalletAddress(): string {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 64; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  }

  /**
   * Simulate API delay for realistic UX
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const taskAPI = new TaskAPI();
