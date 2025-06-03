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
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed' | 'status'>,
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
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed' | 'status'>,
    walletInfo: WalletInfo
  ): Promise<Task> {
    // Generate UUID matching your expected format: job-{timestamp}-{random}
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const taskUuid = `job-${timestamp}-${randomId}`;
    
    // Create job description with embedded JSON metadata
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
      uuid: taskUuid,
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

    // Create the task object with blockchain job ID as UUID (or use generated UUID if no job ID)
    const newTask: Task = {
      ...taskData,
      uuid: result.jobId || taskUuid,
      timestamp: new Date().toISOString(),
      submitter: walletInfo.address,
      status: 0, // PENDING
      completed: false
    };

    console.log('✅ Task created successfully on SUI blockchain:', {
      uuid: newTask.uuid,
      jobId: result.jobId,
      submitter: newTask.submitter,
      task: newTask.task,
      rewardAmount: newTask.reward_amount,
      metadata: jobDescription
    });
    return newTask;
  }

  /**
   * Create a mock task (fallback when wallet not connected)
   */
  private async createMockTask(
    taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed' | 'status'>
  ): Promise<Task> {
    const newTask: Task = {
      ...taskData,
      uuid: generateTaskUUID(),
      timestamp: new Date().toISOString(),
      submitter: this.generateMockWalletAddress(),
      status: 0, // PENDING
      completed: false
    };

    // Simulate API delay
    await this.simulateDelay(300);
    return newTask;
  }

  /**
   * Create job description with embedded JSON metadata for blockchain storage
   * This ensures the complete task schema is preserved when fetching from blockchain
   */
  private createJobDescription(taskData: Omit<Task, 'uuid' | 'timestamp' | 'submitter' | 'completed' | 'status'>): string {
    // Create the complete JSON metadata matching your desired schema
    const jsonMetadata = {
      task: taskData.task,
      description: taskData.description,
      category: taskData.category,
      urgency: taskData.urgency,
      estimated_duration: taskData.estimated_duration,
      reward_amount: taskData.reward_amount,
      timestamp: new Date().toISOString() // GMT timestamp
    };
    
    // Store JSON metadata as the description for blockchain
    // This ensures when fetchJobsForWallet runs, it can parse the complete structure
    return JSON.stringify(jsonMetadata);
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
        status: completed ? 3 : 0, // VERIFIED if completed, PENDING if not
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
   * Get task statistics - updated to use status-based calculations
   */
  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    active: number;
    pending: number;
    claimed: number;
    awaitingVerification: number;
    totalReward: number;
    avgCompletionTime?: number;
  }> {
    try {
      const tasks = await this.getAllTasks();
      const total = tasks.length;
      
      // Use status-based calculations instead of legacy completed field
      const completed = tasks.filter(task => task.status === 3).length; // VERIFIED
      const active = tasks.filter(task => task.status < 3).length; // PENDING, CLAIMED, COMPLETED
      const pending = tasks.filter(task => task.status === 0).length; // PENDING
      const claimed = tasks.filter(task => task.status === 1).length; // CLAIMED
      const awaitingVerification = tasks.filter(task => task.status === 2).length; // COMPLETED
      
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
    } catch (error) {
      console.error('Error fetching task stats:', error);
      throw new Error('Failed to fetch task statistics');
    }
  }

  /**
   * Claim a task (PENDING -> CLAIMED)
   */
  async claimTask(taskId: string, workerAddress: string, signAndExecuteTransaction?: SignAndExecuteTransactionFunction): Promise<Task> {
    try {
      if (!signAndExecuteTransaction) {
        throw new Error('Wallet not connected. Please connect your wallet to claim tasks.');
      }

      // Use real SUI blockchain API to claim the job
      const result = await suiJobService.claimJob(taskId, signAndExecuteTransaction);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to claim task on blockchain');
      }

      // After successful claim, fetch updated job details
      const jobDetails = await suiJobService.getJobDetails(taskId);
      
      if (!jobDetails) {
        throw new Error('Failed to fetch updated job details after claim');
      }

      // Convert SUI job details to Task format
      const updatedTask: Task = {
        uuid: taskId,
        task: this.parseTaskTypeFromDescription(jobDetails.description),
        description: this.parseDescriptionFromJobDescription(jobDetails.description),
        category: this.parseCategoryFromDescription(jobDetails.description),
        urgency: "standard", // Default urgency since not stored on chain
        submitter: jobDetails.submitter,
        timestamp: new Date().toISOString(),
        estimated_duration: "30 minutes", // Default since not stored on chain
        reward_amount: `${jobDetails.rewardAmount} SUI`,
        status: 1, // CLAIMED
        worker: workerAddress,
        completed: false
      };
      
      return updatedTask;
    } catch (error) {
      console.error('Error claiming task:', error);
      throw new Error('Failed to claim task');
    }
  }

  /**
   * Complete a task (CLAIMED -> COMPLETED)
   */
  async completeTask(taskId: string, workerAddress: string, result: string, signAndExecuteTransaction?: SignAndExecuteTransactionFunction): Promise<Task> {
    try {
      if (!signAndExecuteTransaction) {
        throw new Error('Wallet not connected. Please connect your wallet to complete tasks.');
      }

      // Use real SUI blockchain API to complete the job
      const completeResult = await suiJobService.completeJob(taskId, result, signAndExecuteTransaction);
      
      if (!completeResult.success) {
        throw new Error(completeResult.error || 'Failed to complete task on blockchain');
      }

      // After successful completion, fetch updated job details
      const jobDetails = await suiJobService.getJobDetails(taskId);
      
      if (!jobDetails) {
        throw new Error('Failed to fetch updated job details after completion');
      }

      // Convert SUI job details to Task format
      const updatedTask: Task = {
        uuid: taskId,
        task: this.parseTaskTypeFromDescription(jobDetails.description),
        description: this.parseDescriptionFromJobDescription(jobDetails.description),
        category: this.parseCategoryFromDescription(jobDetails.description),
        urgency: "standard", // Default urgency since not stored on chain
        submitter: jobDetails.submitter,
        timestamp: new Date().toISOString(),
        estimated_duration: "30 minutes", // Default since not stored on chain
        reward_amount: `${jobDetails.rewardAmount} SUI`,
        status: 2, // COMPLETED
        worker: workerAddress,
        result: result,
        completed: true
      };
      
      return updatedTask;
    } catch (error) {
      console.error('Error completing task:', error);
      throw new Error('Failed to complete task');
    }
  }

  /**
   * Verify a task (COMPLETED -> VERIFIED)
   */
  async verifyTask(taskId: string, submitterAddress: string, signAndExecuteTransaction?: SignAndExecuteTransactionFunction): Promise<Task> {
    try {
      if (!signAndExecuteTransaction) {
        throw new Error('Wallet not connected. Please connect your wallet to verify tasks.');
      }

      console.log(`🔍 Starting verification for task ${taskId}...`);

      // Use real SUI blockchain API to verify and release payment
      const verifyResult = await suiJobService.verifyAndRelease(taskId, signAndExecuteTransaction);
      
      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Failed to verify task on blockchain');
      }

      console.log(`✅ Verification transaction successful for task ${taskId}, fetching updated details...`);

      // After successful verification, fetch updated job details with retry logic
      const jobDetails = await suiJobService.getJobDetailsAfterVerification(taskId);
      
      if (!jobDetails) {
        throw new Error('Failed to fetch updated job details after verification');
      }

      console.log(`📋 Successfully retrieved verified job details for task ${taskId}`);

      // Convert SUI job details to Task format
      const updatedTask: Task = {
        uuid: taskId,
        task: this.parseTaskTypeFromDescription(jobDetails.description),
        description: this.parseDescriptionFromJobDescription(jobDetails.description),
        category: this.parseCategoryFromDescription(jobDetails.description),
        urgency: "standard", // Default urgency since not stored on chain
        submitter: submitterAddress,
        timestamp: new Date().toISOString(),
        estimated_duration: "30 minutes", // Default since not stored on chain
        reward_amount: `${jobDetails.rewardAmount} SUI`,
        status: 3, // VERIFIED
        worker: jobDetails.worker || undefined,
        result: jobDetails.result || undefined,
        completed: true
      };
      
      return updatedTask;
    } catch (error) {
      console.error('Error verifying task:', error);
      throw new Error('Failed to verify task');
    }
  }

  /**
   * Reject a task (COMPLETED -> PENDING)
   */
  async rejectTask(taskId: string, submitterAddress: string, reason?: string, signAndExecuteTransaction?: SignAndExecuteTransactionFunction): Promise<Task> {
    try {
      if (!signAndExecuteTransaction) {
        throw new Error('Wallet not connected. Please connect your wallet to reject tasks.');
      }

      // Use real SUI blockchain API to reject the job
      const rejectResult = await suiJobService.rejectJob(taskId, reason || 'Work quality does not meet requirements', signAndExecuteTransaction);
      
      if (!rejectResult.success) {
        throw new Error(rejectResult.error || 'Failed to reject task on blockchain');
      }

      // After successful rejection, fetch updated job details
      const jobDetails = await suiJobService.getJobDetails(taskId);
      
      if (!jobDetails) {
        throw new Error('Failed to fetch updated job details after rejection');
      }

      // Convert SUI job details to Task format
      const updatedTask: Task = {
        uuid: taskId,
        task: this.parseTaskTypeFromDescription(jobDetails.description),
        description: this.parseDescriptionFromJobDescription(jobDetails.description),
        category: this.parseCategoryFromDescription(jobDetails.description),
        urgency: "standard", // Default urgency since not stored on chain
        submitter: submitterAddress,
        timestamp: new Date().toISOString(),
        estimated_duration: "30 minutes", // Default since not stored on chain
        reward_amount: `${jobDetails.rewardAmount} SUI`,
        status: 0, // PENDING (back to available)
        worker: undefined, // Clear worker assignment
        result: undefined, // Clear previous result
        completed: false
      };
      
      return updatedTask;
    } catch (error) {
      console.error('Error rejecting task:', error);
      throw new Error('Failed to reject task');
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
        status: 0, // PENDING
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
        status: 1, // CLAIMED
        worker: "0x1234567890abcdef1234567890abcdef12345678",
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
        status: 2, // COMPLETED
        worker: "0xabcdef1234567890abcdef1234567890abcdef12",
        result: "I have reviewed all 5 blog posts. Post #1 needs minor grammar fixes, Post #2-4 are approved for publication, Post #5 needs content restructuring. All posts follow brand guidelines.",
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
        status: 3, // VERIFIED
        worker: "0xfedcba0987654321fedcba0987654321fedcba09",
        result: "Smart contract audit completed. Found 2 medium-risk vulnerabilities and 3 low-risk issues. All have been documented with recommendations.",
        completed: true
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

  /**
   * Parse task type from job description
   */
  private parseTaskTypeFromDescription(description: string): string {
    try {
      const parsed = JSON.parse(description);
      return parsed.task || 'unknown';
    } catch {
      // If not JSON, try to extract task type from description
      if (description.toLowerCase().includes('translat')) return 'translation';
      if (description.toLowerCase().includes('data')) return 'data-entry';
      if (description.toLowerCase().includes('review')) return 'content-review';
      if (description.toLowerCase().includes('audit')) return 'smart-contract-audit';
      return 'unknown';
    }
  }

  /**
   * Parse description from job description (remove JSON metadata if present)
   */
  private parseDescriptionFromJobDescription(description: string): string {
    try {
      const parsed = JSON.parse(description);
      return parsed.description || parsed.text || description;
    } catch {
      return description;
    }
  }

  /**
   * Parse category from job description
   */
  private parseCategoryFromDescription(description: string): string {
    try {
      const parsed = JSON.parse(description);
      return parsed.category || this.inferCategoryFromTask(parsed.task || description);
    } catch {
      return this.inferCategoryFromTask(description);
    }
  }

  /**
   * Infer category from task type or description
   */
  private inferCategoryFromTask(taskOrDescription: string): string {
    const text = taskOrDescription.toLowerCase();
    if (text.includes('translat')) return 'language';
    if (text.includes('data') || text.includes('entry')) return 'admin';
    if (text.includes('review') || text.includes('content')) return 'content';
    if (text.includes('audit') || text.includes('contract') || text.includes('security')) return 'development';
    if (text.includes('design') || text.includes('ui') || text.includes('ux')) return 'design';
    if (text.includes('research')) return 'research';
    if (text.includes('marketing')) return 'marketing';
    return 'other';
  }
}

// Export singleton instance
export const taskAPI = new TaskAPI();
