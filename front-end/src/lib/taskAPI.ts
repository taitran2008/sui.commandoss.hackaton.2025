import { Task } from '@/types/task';
import { generateTaskUUID } from '@/utils/taskUtils';
import { APP_CONFIG } from '@/config/app';
import { suiJobService } from '@/lib/suiJobService';
import { Transaction } from '@mysten/sui/transactions';

/**
 * Enhanced API utilities for backend integration with proper UUID handling
 */

// Type for the signAndExecuteTransaction function from @mysten/dapp-kit
type SignAndExecuteTransactionFunction = (
  args: {
    transaction: Transaction;
    options?: {
      showEffects?: boolean;
      showEvents?: boolean;
    };
  },
  callbacks?: {
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
  }
) => void;

// Interface for wallet information needed for task creation
export interface WalletInfo {
  address: string;
  signAndExecuteTransaction: SignAndExecuteTransactionFunction;
}

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
   * Create a new task - now integrated with SUI blockchain
   */
  async createTask(
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed'>,
    walletInfo?: WalletInfo
  ): Promise<Task> {
    try {
      // If wallet info is provided, submit to SUI blockchain
      if (walletInfo) {
        return await this.createSuiTask(taskData, walletInfo);
      } else {
        // Fallback to mock task for cases where wallet is not connected
        return await this.createMockTask(taskData);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Create a task on SUI blockchain
   */
  private async createSuiTask(
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed'>,
    walletInfo: WalletInfo
  ): Promise<Task> {
    // Create job description similar to JobSubmissionForm
    const jobDescription = this.createJobDescription(taskData);
    
    // Parse reward amount (remove "SUI" suffix if present)
    const rewardAmountStr = taskData.reward_amount.replace(/\s*SUI\s*$/i, '');
    const rewardAmount = parseFloat(rewardAmountStr);
    
    if (isNaN(rewardAmount) || rewardAmount <= 0) {
      throw new Error('Invalid reward amount');
    }

    // Calculate timeout in minutes from estimated_duration
    const timeoutMinutes = this.parseEstimatedDurationToMinutes(taskData.estimated_duration);

    console.log('🔗 Submitting task to SUI blockchain:', {
      description: jobDescription,
      rewardAmount,
      timeoutMinutes,
      walletAddress: walletInfo.address
    });

    // Submit job to SUI blockchain
    const result = await suiJobService.submitJob(
      jobDescription,
      rewardAmount,
      timeoutMinutes,
      walletInfo.signAndExecuteTransaction
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to submit job to blockchain');
    }

    // Create the task object with blockchain job ID as UUID
    const newTask: Task = {
      ...taskData,
      uuid: result.jobId || generateTaskUUID(),
      timestamp: new Date().toISOString(),
      submitter: walletInfo.address,
      completed: false
    };

    console.log('✅ Task created successfully on SUI blockchain:', {
      uuid: newTask.uuid,
      jobId: result.jobId,
      submitter: newTask.submitter,
      task: newTask.task,
      rewardAmount: newTask.reward_amount
    });
    return newTask;
  }

  /**
   * Create a mock task (fallback when wallet not connected)
   */
  private async createMockTask(
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed'>
  ): Promise<Task> {
    const newTask: Task = {
      ...taskData,
      uuid: generateTaskUUID(),
      timestamp: new Date().toISOString(),
      submitter: this.generateMockWalletAddress(),
      completed: false
    };

    // Simulate API delay
    await this.simulateDelay(300);
    return newTask;
  }

  /**
   * Create job description similar to JobSubmissionForm
   */
  private createJobDescription(taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed'>): string {
    const urgencyEmoji = this.getUrgencyEmoji(taskData.urgency);
    const categoryEmoji = this.getCategoryEmoji(taskData.category);
    
    return `${urgencyEmoji} ${taskData.task}\n\n${categoryEmoji} Category: ${taskData.category}\n📝 ${taskData.description}\n⏱️ Duration: ${taskData.estimated_duration}\n💰 Reward: ${taskData.reward_amount}`;
  }

  /**
   * Parse estimated duration string to minutes
   */
  private parseEstimatedDurationToMinutes(duration: string): number {
    // Default timeout if parsing fails
    let timeoutMinutes = 120;
    
    // Extract number from duration string (e.g., "2 hours" -> 2)
    const match = duration.match(/(\d+)/);
    if (match) {
      const value = parseInt(match[1]);
      if (duration.toLowerCase().includes('hour')) {
        timeoutMinutes = value * 60;
      } else if (duration.toLowerCase().includes('minute')) {
        timeoutMinutes = value;
      } else if (duration.toLowerCase().includes('day')) {
        timeoutMinutes = value * 24 * 60;
      }
    }
    
    // Ensure timeout is within SUI contract limits (30 minutes to 48 hours)
    return Math.max(30, Math.min(2880, timeoutMinutes));
  }

  /**
   * Get urgency emoji
   */
  private getUrgencyEmoji(urgency: string): string {
    const urgencyMap: Record<string, string> = {
      low: '🔵',
      standard: '🟡',
      high: '🟠',
      urgent: '🔴'
    };
    return urgencyMap[urgency] || '🟡';
  }

  /**
   * Get category emoji
   */
  private getCategoryEmoji(category: string): string {
    const categoryMap: Record<string, string> = {
      translation: '🌐',
      'data-entry': '📊',
      writing: '✍️',
      design: '🎨',
      development: '💻',
      research: '🔍',
      marketing: '📢',
      system: '⚙️'
    };
    return categoryMap[category] || '📋';
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
