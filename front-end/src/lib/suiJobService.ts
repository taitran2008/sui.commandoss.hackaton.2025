/**
 * SUI Job Service - Adapted from alice_jobs.js for React/Next.js
 * 
 * This service handles:
 * 1. Querying for JobSubmitted events by wallet address
 * 2. Retrieving job objects and their details
 * 3. Converting SUI job data to UI-compatible Task objects
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Task, TASK_STATUS } from '@/types/task';
import { SUI_CONTRACT_CONFIG, SuiNetwork } from '@/config/sui';
import { SuiNetworkUtils } from '@/utils/suiNetworkUtils';

// Type for the signAndExecuteTransaction function from @mysten/dapp-kit
// Using the actual types from the library
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

// Contract constants from configuration
const PACKAGE_ID = SUI_CONTRACT_CONFIG.PACKAGE_ID;

// SUI Job Status mapping
export enum SuiJobStatus {
  PENDING = 0,
  CLAIMED = 1,
  COMPLETED = 2,
  VERIFIED = 3,
}

export interface SuiJobDetails {
  description: string;
  rewardAmount: number;
  submitter: string;
  worker: string | null;
  result: string | null;
  status: SuiJobStatus;
}

export interface SuiJobTimestamps {
  createdAt: number | null;
  claimedAt: number | null;
  completedAt: number | null;
}

export interface SuiJobEvent {
  id: {
    eventSeq: string;
    txDigest: string;
  };
  parsedJson: {
    job_id: string;
    submitter: string;
    description?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  timestampMs: string;
}

export class SuiJobService {
  private client: SuiClient;
  private network: SuiNetwork;

  constructor(network: SuiNetwork = 'testnet') {
    this.network = network;
    this.client = new SuiClient({ url: getFullnodeUrl(network) });
  }



  /**
   * Format timestamp for display in user's local timezone
   */
  private formatTimestampForDisplay(timestamp: string | number | null): string {
    if (!timestamp) return new Date().toLocaleString();
    
    let date: Date;
    
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      if (timestamp.includes('T')) {
        // ISO string format - JavaScript automatically handles GMT/UTC conversion
        date = new Date(timestamp);
      } else {
        // Try parsing as number in string format
        const numTimestamp = Number(timestamp);
        if (!isNaN(numTimestamp)) {
          date = new Date(numTimestamp);
        } else {
          // Fallback for other string formats
          date = new Date(timestamp);
        }
      }
    } else {
      // Numeric timestamp (milliseconds)
      date = new Date(Number(timestamp));
    }
    
    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp for display:', timestamp);
      return new Date().toLocaleString();
    }
    
    // Format for display in user's local timezone
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Parse job payload safely
   */
  private parseJobPayload(description: string): { task: string; fullDescription: string; category: string } {
    try {
      // More comprehensive cleaning to remove various invisible characters
      let cleanedDescription = description
        .trim()                           // Remove leading/trailing whitespace
        .replace(/^\uFEFF/, '')          // Remove BOM (Byte Order Mark)
        .replace(/^[\u200B-\u200D\uFEFF\u00A0]+/, '') // Remove zero-width spaces and non-breaking spaces
        .replace(/^[\x00-\x1F\x7F-\x9F]+/, '')        // Remove control characters
        .replace(/^\s+/, '');            // Remove any remaining whitespace
      
      // Find the first occurrence of '{' and start from there
      const jsonStart = cleanedDescription.indexOf('{');
      if (jsonStart > 0) {
        cleanedDescription = cleanedDescription.substring(jsonStart);
      }
      
      // Try to parse as JSON first
      const parsed = JSON.parse(cleanedDescription);
      console.log('Parsed job payload:', parsed);
      // Check if this is a valid JSON structure with expected fields
      if (typeof parsed === 'object' && parsed !== null) {
        // Handle both old format (with uuid) and new format
        const taskName = parsed.task || parsed.title || 'Unknown Task';
        const category = parsed.category || 'other';
        
        // If it has uuid field, it's likely from the old system - extract meaningful data
        if (parsed.uuid && typeof parsed.task === 'string') {
          return {
            task: taskName,
            fullDescription: parsed.description || description,
            category: category
          };
        }
        
        // Handle new JSON schema format with separate description field
        if (parsed.description && typeof parsed.description === 'string') {
          return {
            task: taskName,
            fullDescription: parsed.description,
            category: category
          };
        }
        
        // Otherwise, use the parsed data as-is
        return {
          task: taskName,
          fullDescription: description,
          category: category
        };
      }
      
      // If parsed is not an object, treat as plain text
      return {
        task: description.slice(0, 100),
        fullDescription: description,
        category: 'other'
      };
    } catch {
      // If not JSON, extract task name from description
      const lines = description.split('\n');
      const taskLine = lines.find(line => line.toLowerCase().includes('task:') || line.toLowerCase().includes('title:'));
      const task = taskLine ? taskLine.split(':')[1]?.trim() || description.slice(0, 100) : description.slice(0, 100);
      
      return {
        task,
        fullDescription: description,
        category: 'other'
      };
    }
  }

  /**
   * Check if an object exists on the blockchain
   */
  private async objectExists(objectId: string): Promise<boolean> {
    try {
      const object = await this.retryOperation(async () => {
        return await this.client.getObject({
          id: objectId,
          options: { showType: true }
        });
      }, 2, 300); // Quick retry for existence checks
      return object.data !== null && object.error === undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed job information using devInspectTransactionBlock
   */
  async getJobDetails(jobId: string): Promise<SuiJobDetails | null> {
    try {
      // First check if the object exists to avoid the "deleted" error
      const exists = await this.objectExists(jobId);
      if (!exists) {
        console.log(`Job ${jobId} has been deleted or does not exist`);
        return null;
      }

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::job_queue::get_job_details`,
        arguments: [txb.object(jobId)],
      });

      const result = await SuiNetworkUtils.devInspectTransactionBlock(
        this.client,
        txb,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        this.network,
        10000 // 10 second timeout
      );

      if (result.results && result.results[0] && result.results[0].returnValues) {
        const returnValues = result.results[0].returnValues;
        
        // Parse return values: [description, reward_amount, submitter, worker, result, status]
        const description = returnValues[0] ? Buffer.from(returnValues[0][0].slice(1)).toString('utf8') : '';
        const rewardAmount = returnValues[1] ? Number(returnValues[1][0]) : 0;
        const submitter = returnValues[2] ? '0x' + Buffer.from(returnValues[2][0]).toString('hex') : '';
        const worker = returnValues[3] && returnValues[3][0].length > 1 ? 
          '0x' + Buffer.from(returnValues[3][0].slice(1)).toString('hex') : null;
        const jobResult = returnValues[4] && returnValues[4][0].length > 1 ? 
          Buffer.from(returnValues[4][0].slice(1)).toString('utf8') : null;
        const status = returnValues[5] ? returnValues[5][0][0] : 0;

        return {
          description,
          rewardAmount: rewardAmount / 1000000000, // Convert MIST to SUI
          submitter,
          worker,
          result: jobResult,
          status
        };
      }
    } catch (error) {
      // Check if the error is due to deleted object
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('deleted') || errorMessage.includes('Invalid object')) {
        console.log(`Job ${jobId} has been deleted`);
        return null;
      }
      console.error(`Error getting job details for ${jobId}:`, error);
      return null;
    }
    return null;
  }

  /**
   * Get job timestamps
   */
  async getJobTimestamps(jobId: string): Promise<SuiJobTimestamps | null> {
    try {
      // First check if the object exists to avoid the "deleted" error
      const exists = await this.objectExists(jobId);
      if (!exists) {
        console.log(`Job ${jobId} has been deleted or does not exist`);
        return null;
      }

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::job_queue::get_job_timestamps`,
        arguments: [txb.object(jobId)],
      });

      const result = await SuiNetworkUtils.devInspectTransactionBlock(
        this.client,
        txb,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        this.network,
        10000 // 10 second timeout
      );

      if (result.results && result.results[0] && result.results[0].returnValues) {
        const returnValues = result.results[0].returnValues;
        
        // Parse return values: [created_at, claimed_at, completed_at]
        const createdAt = returnValues[0] ? Number(returnValues[0][0]) : null;
        const claimedAt = returnValues[1] && returnValues[1][0].length > 1 ? 
          Number(returnValues[1][0].slice(1)) : null;
        const completedAt = returnValues[2] && returnValues[2][0].length > 1 ? 
          Number(returnValues[2][0].slice(1)) : null;

        return {
          createdAt,
          claimedAt,
          completedAt
        };
      }
    } catch (error) {
      // Check if the error is due to deleted object
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('deleted') || errorMessage.includes('Invalid object')) {
        console.log(`Job ${jobId} has been deleted`);
        return null;
      }
      console.error(`Error getting job timestamps for ${jobId}:`, error);
      return null;
    }
    return null;
  }

  /**
   * Retry wrapper with exponential backoff for network requests
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();
        
        // Check if it's a network/fetch error that we should retry
        const isRetryableError = errorMessage.includes('failed to fetch') ||
                                errorMessage.includes('network error') ||
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('429') ||
                                errorMessage.includes('too many requests') ||
                                errorMessage.includes('connection') ||
                                errorMessage.includes('fetch') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('econnreset') ||
                                errorMessage.includes('enotfound');
        
        if (!isRetryableError || attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff with jitter
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Query for JobSubmitted events by wallet address with robust error handling
   */
  async getJobsSubmittedByAddress(walletAddress: string): Promise<SuiJobEvent[]> {
    try {
      console.log(`Querying JobSubmitted events for address: ${walletAddress}`);
      
      // Use retry wrapper for the network request
      const events = await this.retryOperation(async () => {
        return await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::job_queue::JobSubmitted`
          },
          limit: Math.min(SUI_CONTRACT_CONFIG.defaults.QUERY_LIMIT, 25), // Reduce limit to avoid timeouts
          order: 'descending'
        });
      });

      console.log(`Successfully retrieved ${events.data.length} JobSubmitted events`);

      // Filter events by wallet address
      const userJobs = events.data.filter((event) => {
        try {
          const eventData = event.parsedJson as {
            job_id: string;
            submitter: string;
            description?: string;
            [key: string]: string | number | boolean | null | undefined;
          };
          return eventData && eventData.submitter === walletAddress;
        } catch (parseError) {
          console.warn('Failed to parse event data:', parseError, event);
          return false;
        }
      });

      console.log(`Found ${userJobs.length} jobs submitted by ${walletAddress}`);
      return userJobs as SuiJobEvent[];
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error querying JobSubmitted events:', {
        error: errorMessage,
        walletAddress,
        timestamp: new Date().toISOString()
      });
      
      // For network errors, try alternative approach
      if (errorMessage.toLowerCase().includes('failed to fetch') || 
          errorMessage.toLowerCase().includes('network')) {
        console.warn('Network error detected, trying alternative query approach...');
        return await this.getJobsSubmittedByAddressFallback(walletAddress);
      }
      
      return [];
    }
  }

  /**
   * Fallback method for querying events with smaller batches
   */
  private async getJobsSubmittedByAddressFallback(walletAddress: string): Promise<SuiJobEvent[]> {
    try {
      console.log('Using fallback method with smaller query limit...');
      
      // Try with very small limit first
      const events = await this.retryOperation(async () => {
        return await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::job_queue::JobSubmitted`
          },
          limit: 10, // Much smaller limit
          order: 'descending'
        });
      }, 2, 500); // Fewer retries with shorter delay

      const userJobs = events.data.filter((event) => {
        try {
          const eventData = event.parsedJson as {
            job_id: string;
            submitter: string;
            description?: string;
            [key: string]: string | number | boolean | null | undefined;
          };
          return eventData && eventData.submitter === walletAddress;
        } catch (parseError) {
          console.warn('Failed to parse event data in fallback:', parseError);
          return false;
        }
      });

      console.log(`Fallback method found ${userJobs.length} jobs submitted by ${walletAddress}`);
      return userJobs as SuiJobEvent[];
      
    } catch (error) {
      console.error('Fallback method also failed:', error);
      return [];
    }
  }

  /**
   * Convert SUI job data to UI Task format
   */
  private convertSuiJobToTask(
    event: SuiJobEvent, 
    details: SuiJobDetails | null, 
    timestamps: SuiJobTimestamps | null
  ): Task {
    const parsedPayload = this.parseJobPayload(details?.description || event.parsedJson.description || '');
    // Try to parse the description as JSON to extract additional metadata
    let jsonMetadata: {
      task?: string;
      description?: string;
      urgency?: string;
      estimated_duration?: string;
      reward_amount?: string;
      timestamp?: string;
      category?: string;
      [key: string]: string | number | boolean | null | undefined;
    } | null = null;
    try {
      const rawDescription = details?.description || event.parsedJson.description || '';

      // More comprehensive cleaning to remove various invisible characters
      let cleanedDescription = rawDescription
        .trim()                           // Remove leading/trailing whitespace
        .replace(/^\uFEFF/, '')          // Remove BOM (Byte Order Mark)
        .replace(/^[\u200B-\u200D\uFEFF\u00A0]+/, '') // Remove zero-width spaces and non-breaking spaces
        .replace(/^[\x00-\x1F\x7F-\x9F]+/, '')        // Remove control characters
        .replace(/^\s+/, '');            // Remove any remaining whitespace
      
      // Find the first occurrence of '{' and start from there
      const jsonStart = cleanedDescription.indexOf('{');
      if (jsonStart > 0) {
        cleanedDescription = cleanedDescription.substring(jsonStart);
      }

      jsonMetadata = JSON.parse(cleanedDescription);
    } catch {
      // JSON parsing failed - this is normal for non-JSON descriptions
      console.log('JSON parsing failed for job:', event.parsedJson.job_id, 'Using blockchain data.');
    }
    // Determine urgency - prefer JSON metadata, then reward-based calculation
    let urgency: 'low' | 'standard' | 'high' | 'urgent' = 'standard';
    if (jsonMetadata?.urgency && 
        typeof jsonMetadata.urgency === 'string' &&
        ['low', 'standard', 'high', 'urgent'].includes(jsonMetadata.urgency)) {
      urgency = jsonMetadata.urgency as 'low' | 'standard' | 'high' | 'urgent';
    } else if (details?.rewardAmount) {
      if (details.rewardAmount >= 10) urgency = 'urgent';
      else if (details.rewardAmount >= 5) urgency = 'high';
      else if (details.rewardAmount >= 1) urgency = 'standard';
      else urgency = 'low';
    }

    // Estimate duration - prefer JSON metadata, then urgency-based calculation
    let estimatedDuration = '2-4 hours';
    if (jsonMetadata?.estimated_duration && typeof jsonMetadata.estimated_duration === 'string') {
      estimatedDuration = jsonMetadata.estimated_duration;
    } else {
      if (urgency === 'urgent') estimatedDuration = '30min-1hour';
      else if (urgency === 'high') estimatedDuration = '1-2 hours';
      else if (urgency === 'low') estimatedDuration = '4-8 hours';
    }

    // Determine reward amount - prefer JSON metadata, then blockchain details
    let rewardAmount = '0 SUI';
    if (jsonMetadata?.reward_amount && typeof jsonMetadata.reward_amount === 'string') {
      rewardAmount = jsonMetadata.reward_amount;
    } else if (details?.rewardAmount) {
      rewardAmount = `${details.rewardAmount} SUI`;
    }

    // Determine timestamp - prefer JSON metadata (which may be in GMT), then blockchain timestamps
    let displayTimestamp: string;
    if (jsonMetadata?.timestamp && typeof jsonMetadata.timestamp === 'string') {
      // Use timestamp from JSON metadata (assume GMT) and convert to user's timezone for display
      displayTimestamp = this.formatTimestampForDisplay(jsonMetadata.timestamp);
    } else {
      // Fall back to blockchain timestamps
      displayTimestamp = this.formatTimestampForDisplay(timestamps?.createdAt || event.timestampMs);
    }

    // Debug logging for reward amount and timestamp conversion
    console.log('Debug conversion:', {
      jobId: event.parsedJson.job_id,
      rewardSource: jsonMetadata?.reward_amount ? 'jsonMetadata' : 'blockchain',
      jsonReward: jsonMetadata?.reward_amount,
      blockchainReward: details?.rewardAmount,
      finalReward: rewardAmount,
      timestampSource: jsonMetadata?.timestamp ? 'jsonMetadata (GMT)' : 'blockchain',
      jsonTimestamp: jsonMetadata?.timestamp,
      blockchainTimestamp: timestamps?.createdAt,
      eventTimestamp: event.timestampMs,
      finalTimestamp: displayTimestamp,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      gmtToLocalConversion: jsonMetadata?.timestamp ? 
        `${jsonMetadata.timestamp} -> ${displayTimestamp}` : 'N/A'
    });

    return {
      uuid: event.parsedJson.job_id,
      task: jsonMetadata?.task || parsedPayload.task,
      description: jsonMetadata?.description || parsedPayload.fullDescription,
      category: jsonMetadata?.category || parsedPayload.category,
      urgency,
      submitter: event.parsedJson.submitter,
      timestamp: displayTimestamp,
      estimated_duration: estimatedDuration,
      reward_amount: rewardAmount,
      status: details?.status ?? 0, // Use blockchain status or default to PENDING
      worker: details?.worker || undefined,
      result: details?.result || undefined,
      completed: details?.status === SuiJobStatus.COMPLETED || details?.status === SuiJobStatus.VERIFIED
    };
  }

  /**
   * Fetch all jobs for a wallet address and convert to Task format
   */
  async fetchJobsForWallet(walletAddress: string): Promise<Task[]> {
    if (!walletAddress) {
      return [];
    }

    try {
      const jobEvents = await this.getJobsSubmittedByAddress(walletAddress);
      const tasks: Task[] = [];

      for (const event of jobEvents) {
        const jobId = event.parsedJson.job_id;
        
        try {
          // Get detailed job information
          const [jobDetails, jobTimestamps] = await Promise.all([
            this.getJobDetails(jobId),
            this.getJobTimestamps(jobId)
          ]);

          // If job details are null (deleted job), create a placeholder task
          if (!jobDetails) {
            console.log(`Job ${jobId} appears to be deleted, creating placeholder entry`);
            const deletedTask: Task = {
              uuid: jobId,
              task: 'Deleted Job',
              description: 'This job has been deleted from the blockchain',
              category: 'other',
              urgency: 'low',
              submitter: event.parsedJson.submitter,
              timestamp: this.formatTimestampForDisplay(event.timestampMs),
              estimated_duration: 'N/A',
              reward_amount: 'N/A',
              status: TASK_STATUS.VERIFIED, // Mark as verified since it's deleted
              completed: true // Mark as completed since it's deleted
            };
            tasks.push(deletedTask);
            continue;
          }

          // Convert to Task format with valid job details
          const task = this.convertSuiJobToTask(event, jobDetails, jobTimestamps);
          tasks.push(task);
        } catch (error) {
          console.error(`Error processing job ${jobId}:`, error);
          // Create a fallback task for jobs that failed to process
          const fallbackTask: Task = {
            uuid: jobId,
            task: 'Error Loading Job',
            description: 'Failed to load job details from the blockchain',
            category: 'other',
            urgency: 'low',
            submitter: event.parsedJson.submitter,
            timestamp: this.formatTimestampForDisplay(event.timestampMs),
            estimated_duration: 'N/A',
            reward_amount: 'N/A',
            status: TASK_STATUS.PENDING, // Default to pending for failed jobs
            completed: false
          };
          tasks.push(fallbackTask);
        }
      }

      return tasks;
    } catch (error) {
      console.error('Error fetching jobs for wallet:', error);
      return [];
    }
  }

  /**
   * Get SUI Explorer URL for an object/transaction
   */
  getExplorerUrl(objectId: string, type: 'object' | 'txn' = 'object'): string {
    const networkConfig = SUI_CONTRACT_CONFIG.networks[this.network as keyof typeof SUI_CONTRACT_CONFIG.networks];
    return `${networkConfig.explorerUrl}/${type}/${objectId}?network=${this.network}`;
  }

  /**
   * Check SUI balance for a wallet address
   */
  async getSuiBalance(address: string): Promise<number> {
    try {
      const balance = await this.client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
      });
      return Number(balance.totalBalance) / 1000000000; // Convert MIST to SUI
    } catch (error) {
      console.error('Error getting SUI balance:', error);
      return 0;
    }
  }

  /**
   * Delete Job Workflow Methods
   * These methods implement the self-verification workflow for deleting jobs
   */

  /**
   * Step 1: Claim a job (for self-verification)
   */
  async claimJob(jobId: string, signAndExecuteTransaction: SignAndExecuteTransactionFunction): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const transaction = new Transaction();
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::claim_job`,
          arguments: [
            transaction.object(SUI_CONTRACT_CONFIG.MANAGER_ID),
            transaction.object(jobId),
            transaction.object(SUI_CONTRACT_CONFIG.CLOCK_ID),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result) => {
              console.log('Claim job transaction result:', result);
              resolve({ success: true });
            },
            onError: (error) => {
              console.error('Error claiming job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error claiming job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Step 2: Complete a job with result
   */
  async completeJob(jobId: string, result: string, signAndExecuteTransaction: SignAndExecuteTransactionFunction): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const transaction = new Transaction();
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::complete_job`,
          arguments: [
            transaction.object(jobId),
            transaction.pure.string(result),
            transaction.object(SUI_CONTRACT_CONFIG.CLOCK_ID),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result) => {
              console.log('Complete job transaction result:', result);
              resolve({ success: true });
            },
            onError: (error) => {
              console.error('Error completing job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error completing job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Step 3: Verify and release payment to self
   */
  async verifyAndRelease(jobId: string, signAndExecuteTransaction: SignAndExecuteTransactionFunction): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const transaction = new Transaction();
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::verify_and_release`,
          arguments: [
            transaction.object(jobId),
            transaction.object(SUI_CONTRACT_CONFIG.CLOCK_ID),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result) => {
              console.log('Verify and release transaction result:', result);
              resolve({ success: true });
            },
            onError: (error) => {
              console.error('Error verifying and releasing job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error verifying and releasing job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Step 4: Delete the verified job to get storage rebate
   */
  async deleteJob(jobId: string, signAndExecuteTransaction: SignAndExecuteTransactionFunction): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const transaction = new Transaction();
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::delete_job`,
          arguments: [
            transaction.object(jobId),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result) => {
              console.log('Delete job transaction result:', result);
              resolve({ success: true });
            },
            onError: (error) => {
              console.error('Error deleting job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error deleting job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Complete self-verification workflow to delete a job
   * This executes all 4 steps in sequence: claim, complete, verify & release, delete
   */
  async deleteJobWorkflow(
    jobId: string, 
    signAndExecuteTransaction: SignAndExecuteTransactionFunction,
    onProgress?: (step: number, message: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Claim the job
      onProgress?.(1, 'Claiming job...');
      const claimResult = await this.claimJob(jobId, signAndExecuteTransaction);
      if (!claimResult.success) {
        return { success: false, error: `Failed to claim job: ${claimResult.error}` };
      }

      // Wait for transaction to be finalized
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Complete the job
      onProgress?.(2, 'Completing job with cancellation message...');
      const completeResult = await this.completeJob(jobId, "JOB CANCELLED BY SUBMITTER - Self-verification for deletion", signAndExecuteTransaction);
      if (!completeResult.success) {
        return { success: false, error: `Failed to complete job: ${completeResult.error}` };
      }

      // Wait for transaction to be finalized
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Verify and release payment
      onProgress?.(3, 'Verifying and releasing payment...');
      const verifyResult = await this.verifyAndRelease(jobId, signAndExecuteTransaction);
      if (!verifyResult.success) {
        return { success: false, error: `Failed to verify and release: ${verifyResult.error}` };
      }

      // Wait for transaction to be finalized
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 4: Delete the job
      onProgress?.(4, 'Deleting job and reclaiming storage...');
      const deleteResult = await this.deleteJob(jobId, signAndExecuteTransaction);
      if (!deleteResult.success) {
        return { success: false, error: `Failed to delete job: ${deleteResult.error}` };
      }

      onProgress?.(4, 'Job deleted successfully!');
      return { success: true };
    } catch (error) {
      console.error('Error in delete job workflow:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reject a completed job and make it available for other workers
   * This corresponds to step 5 in case2.js where Alice rejects Bob's poor quality work
   */
  async rejectJob(
    jobId: string, 
    reason: string,
    signAndExecuteTransaction: SignAndExecuteTransactionFunction
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const transaction = new Transaction();
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::reject_job`,
          arguments: [
            transaction.object(SUI_CONTRACT_CONFIG.MANAGER_ID),
            transaction.object(jobId),
            transaction.pure.string(reason),
            transaction.object(SUI_CONTRACT_CONFIG.CLOCK_ID),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result) => {
              console.log('Reject job transaction result:', result);
              resolve({ success: true });
            },
            onError: (error) => {
              console.error('Error rejecting job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error rejecting job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Submit a new job to the blockchain
   * This creates a new job with description, reward amount, and timeout
   */
  async submitJob(
    description: string,
    rewardAmountSui: number,
    timeoutMinutes: number,
    signAndExecuteTransaction: SignAndExecuteTransactionFunction
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        // Validate inputs
        if (!description.trim()) {
          resolve({ success: false, error: 'Job description cannot be empty' });
          return;
        }
        
        if (rewardAmountSui <= 0) {
          resolve({ success: false, error: 'Reward amount must be greater than 0' });
          return;
        }
        
        if (timeoutMinutes < 30 || timeoutMinutes > 2880) {
          resolve({ success: false, error: 'Timeout must be between 30 and 2880 minutes (48 hours)' });
          return;
        }

        const transaction = new Transaction();
        
        // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
        const rewardAmountMist = Math.floor(rewardAmountSui * 1000000000);
        
        // Split coins for the reward
        const [coin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(rewardAmountMist)]);
        
        transaction.moveCall({
          target: `${PACKAGE_ID}::job_queue::submit_job`,
          arguments: [
            transaction.object(SUI_CONTRACT_CONFIG.MANAGER_ID),
            transaction.pure.string(description),
            coin,
            transaction.pure.u64(timeoutMinutes),
            transaction.object(SUI_CONTRACT_CONFIG.CLOCK_ID),
          ],
        });

        signAndExecuteTransaction(
          {
            transaction,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          {
            onSuccess: (result: unknown) => {
              console.log('Submit job transaction result:', result);
              
              // Extract job ID from created objects
              let jobId = null;
              if (result && typeof result === 'object' && 'effects' in result) {
                const effects = (result as { effects?: { created?: Array<{ owner?: unknown; reference?: { objectId: string } }> } }).effects;
                if (effects?.created) {
                  const createdObjects = effects.created;
                  // Find the job object (it should be the shared object)
                  const jobObject = createdObjects.find((obj: { owner?: unknown; reference?: { objectId: string } }) => 
                    obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner
                  );
                  if (jobObject?.reference?.objectId) {
                    jobId = jobObject.reference.objectId;
                  }
                }
              }
              
              resolve({ success: true, jobId: jobId || undefined });
            },
            onError: (error) => {
              console.error('Error submitting job:', error);
              resolve({ success: false, error: error.message });
            }
          }
        );
      } catch (error) {
        console.error('Error submitting job:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Get job details with retries specifically for post-verification scenarios
   * Uses more aggressive retry logic since blockchain state might take time to propagate
   */
  async getJobDetailsAfterVerification(jobId: string): Promise<SuiJobDetails | null> {
    console.log(`⏳ Waiting for verification transaction to be finalized for job ${jobId}...`);
    // First wait a moment for the transaction to be finalized
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`🔄 Attempting to fetch job details with retry logic for job ${jobId}...`);
    // Use more aggressive retry logic for post-verification queries
    return await this.retryOperation(async () => {
      const details = await this.getJobDetails(jobId);
      if (!details) {
        console.log(`⚠️ Job details not available yet for ${jobId}, retrying...`);
        throw new Error('Job details not available yet after verification');
      }
      // Verify the job is actually in verified status (status: 3)
      if (details.status !== 3) {
        const statusText = this.getJobStatusText(details.status);
        console.log(`⚠️ Job ${jobId} not yet verified - current status: ${details.status} (${statusText}), retrying...`);
        throw new Error(`Job not yet verified - current status: ${details.status} (${statusText})`);
      }
      console.log(`✅ Successfully retrieved verified job details for ${jobId}`);
      return details;
    }, 5, 1000); // 5 retries with 1 second initial delay
  }

  /**
   * Get human-readable job status for debugging
   */
  private getJobStatusText(status: number): string {
    switch(status) {
      case 0: return 'PENDING';
      case 1: return 'CLAIMED';
      case 2: return 'COMPLETED';
      case 3: return 'VERIFIED';
      default: return `UNKNOWN(${status})`;
    }
  }
}

// Export a singleton instance
export const suiJobService = new SuiJobService();
