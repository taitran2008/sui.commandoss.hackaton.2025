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
import { Task } from '@/types/task';
import { SUI_CONTRACT_CONFIG, SuiNetwork } from '@/config/sui';

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
   * Format timestamp from milliseconds
   */
  private formatTimestamp(timestamp: string | number | null): string {
    if (!timestamp) return new Date().toISOString();
    return new Date(Number(timestamp)).toISOString();
  }

  /**
   * Parse job payload safely
   */
  private parseJobPayload(description: string): { task: string; fullDescription: string; category: string } {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(description);
      return {
        task: parsed.task || parsed.title || description.slice(0, 100),
        fullDescription: description,
        category: parsed.category || 'other'
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
   * Get detailed job information using devInspectTransactionBlock
   */
  async getJobDetails(jobId: string): Promise<SuiJobDetails | null> {
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::job_queue::get_job_details`,
        arguments: [txb.object(jobId)],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

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
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::job_queue::get_job_timestamps`,
        arguments: [txb.object(jobId)],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
      });

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
      console.error(`Error getting job timestamps for ${jobId}:`, error);
      return null;
    }
    return null;
  }

  /**
   * Query for JobSubmitted events by wallet address
   */
  async getJobsSubmittedByAddress(walletAddress: string): Promise<SuiJobEvent[]> {
    try {
      // Query for JobSubmitted events
      const events = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::job_queue::JobSubmitted`
        },
        limit: SUI_CONTRACT_CONFIG.defaults.QUERY_LIMIT,
        order: 'descending'
      });

      // Filter events by wallet address
      const userJobs = events.data.filter((event) => {
        const eventData = event.parsedJson as {
          job_id: string;
          submitter: string;
          description?: string;
          [key: string]: string | number | boolean | null | undefined;
        };
        return eventData && eventData.submitter === walletAddress;
      });

      return userJobs as SuiJobEvent[];
    } catch (error) {
      console.error('Error querying JobSubmitted events:', error);
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
    
    // Determine urgency based on reward amount or default to standard
    let urgency: 'low' | 'standard' | 'high' | 'urgent' = 'standard';
    if (details?.rewardAmount) {
      if (details.rewardAmount >= 10) urgency = 'urgent';
      else if (details.rewardAmount >= 5) urgency = 'high';
      else if (details.rewardAmount >= 1) urgency = 'standard';
      else urgency = 'low';
    }

    // Estimate duration based on urgency and reward
    let estimatedDuration = '2-4 hours';
    if (urgency === 'urgent') estimatedDuration = '30min-1hour';
    else if (urgency === 'high') estimatedDuration = '1-2 hours';
    else if (urgency === 'low') estimatedDuration = '4-8 hours';

    return {
      uuid: event.parsedJson.job_id,
      task: parsedPayload.task,
      description: parsedPayload.fullDescription,
      category: parsedPayload.category,
      urgency,
      submitter: event.parsedJson.submitter,
      timestamp: this.formatTimestamp(timestamps?.createdAt || event.timestampMs),
      estimated_duration: estimatedDuration,
      reward_amount: details?.rewardAmount?.toFixed(4) || '0.0000',
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
        
        // Get detailed job information
        const [jobDetails, jobTimestamps] = await Promise.all([
          this.getJobDetails(jobId),
          this.getJobTimestamps(jobId)
        ]);

        // Convert to Task format
        const task = this.convertSuiJobToTask(event, jobDetails, jobTimestamps);
        tasks.push(task);
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
}

// Export a singleton instance
export const suiJobService = new SuiJobService();
