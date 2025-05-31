// Smart Contract Constants for SUI Testnet
export const CONTRACT_CONFIG = {
  PACKAGE_ID: '0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d',
  MANAGER_OBJECT_ID: '0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc',
  CLOCK_OBJECT_ID: '0x6',
  MODULE_NAME: 'job_queue'
} as const

export const JOB_STATUS = {
  PENDING: 0,
  RESERVED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
  DLQ: 4
} as const

export const JOB_STATUS_LABELS = {
  [JOB_STATUS.PENDING]: 'Pending',
  [JOB_STATUS.RESERVED]: 'Processing',
  [JOB_STATUS.COMPLETED]: 'Completed',
  [JOB_STATUS.CANCELLED]: 'Cancelled',
  [JOB_STATUS.DLQ]: 'Failed (DLQ)'
} as const

export const COMMON_QUEUES = [
  'image-processing',
  'data-analysis',
  'email-notifications',
  'file-conversion',
  'backup-tasks'
] as const

// Job creation defaults
export const DEFAULT_STAKE_AMOUNT = 1000000000 // 1 SUI in MIST
export const MIN_STAKE_AMOUNT = 1000 // 0.000001 SUI in MIST
export const MAX_PAYLOAD_SIZE = 4096 // 4KB

// UI Configuration
export const SUISCAN_BASE_URL = 'https://suiscan.xyz/testnet'
