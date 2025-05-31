// Type definitions for the Job Queue System

export interface Job {
  uuid: string
  queue: string
  payload: string
  attempts: number
  status: number
  submitter: string
  priority_stake: string // in MIST
  created_at: string
  available_at: string
  reserved_at?: string
  error_message?: string
}

export interface QueueStats {
  total_jobs: number
  pending_jobs: number
}

export interface WorkerSubscription {
  id: string
  queues: string[]
  batch_size: number
  visibility_timeout: number
  worker_address: string
}

export interface TreasuryInfo {
  balance: string // in MIST
}

// Event types from the smart contract
export interface JobSubmittedEvent {
  uuid: string
  queue: string
  submitter: string
  created_at: number
  priority_stake: number
}

export interface JobReservedEvent {
  uuid: string
  queue: string
  worker: string
  reserved_at: number
}

export interface JobCompletedEvent {
  uuid: string
  queue: string
  worker: string
  completed_at: number
}

export interface JobFailedEvent {
  uuid: string
  queue: string
  worker: string
  attempts: number
  error_message: string
  moved_to_dlq: boolean
}

export interface StakeRefundedEvent {
  uuid: string
  submitter: string
  refund_amount: number
  reason: string
}

// Form data interfaces
export interface JobSubmissionForm {
  jobId: string
  queue: string
  payload: string
  stakeAmount: string // in SUI
}

export interface WorkerRegistrationForm {
  queues: string[]
  batchSize: number
  visibilityTimeout: number
}

// API response types
export interface ContractCallResult {
  success: boolean
  data?: any
  error?: string
  transactionDigest?: string
}

export interface JobDetailsResult extends ContractCallResult {
  data?: Job
}

export interface QueueStatsResult extends ContractCallResult {
  data?: QueueStats
}

export interface TreasuryBalanceResult extends ContractCallResult {
  data?: TreasuryInfo
}

// Utility types
export type JobStatus = 0 | 1 | 2 | 3 | 4 // PENDING | RESERVED | COMPLETED | CANCELLED | DLQ

export interface JobFilters {
  status?: JobStatus
  queue?: string
  submitter?: string
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface PaginationOptions {
  limit: number
  offset: number
}
