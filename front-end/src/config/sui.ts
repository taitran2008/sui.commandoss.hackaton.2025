/**
 * SUI Smart Contract Configuration
 * Update these addresses when deploying to different networks or contracts
 */

export const SUI_CONTRACT_CONFIG = {
  // Smart Contract Addresses
  PACKAGE_ID: '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383',
  MANAGER_ID: '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458',
  CLOCK_ID: '0x6',
  
  // Network Configuration
  networks: {
    mainnet: {
      rpcUrl: 'https://fullnode.mainnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
    },
    testnet: {
      rpcUrl: 'https://fullnode.testnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
    },
    devnet: {
      rpcUrl: 'https://fullnode.devnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
    },
  },
  
  // Module Functions
  functions: {
    GET_JOB_DETAILS: 'job_queue::get_job_details',
    GET_JOB_TIMESTAMPS: 'job_queue::get_job_timestamps',
    SUBMIT_JOB: 'job_queue::submit_job',
    CLAIM_JOB: 'job_queue::claim_job',
    COMPLETE_JOB: 'job_queue::complete_job',
    VERIFY_AND_RELEASE: 'job_queue::verify_and_release',
    DELETE_JOB: 'job_queue::delete_job',
  },
  
  // Event Types
  events: {
    JOB_SUBMITTED: 'job_queue::JobSubmitted',
    JOB_CLAIMED: 'job_queue::JobClaimed',
    JOB_COMPLETED: 'job_queue::JobCompleted',
    JOB_VERIFIED: 'job_queue::JobVerified',
  },
  
  // Default Settings
  defaults: {
    QUERY_LIMIT: 50,
    REFRESH_INTERVAL: 30000, // 30 seconds
    GAS_BUDGET: 1000000000, // 1 SUI
  }
} as const;

export type SuiNetwork = keyof typeof SUI_CONTRACT_CONFIG.networks;
