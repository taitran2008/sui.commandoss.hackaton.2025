# Decentralized Job Queue System

A decentralized job queue system built on the Sui Blockchain, enabling trustless job posting, claiming, completion, and payment verification.

## 🌐 Live Deployments

- **Web2 Link**: https://dptm8b098wb3y.cloudfront.net/
- **Web3 Link (IPFS)**: 
  - http://k51qzi5uqu5dlm9k7sqk5b1s2v7ns2mbdrn9no1jdsoy1bli1c4ots18sp32ov.ipns.localhost:8080/
  - https://ipfs.golinky.me/

## 📋 Smart Contract Details

**Package ID**: `0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383`  
**Manager ID**: `0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458`  
**Network**: Sui Testnet

## 🚀 Core Features

### Job Lifecycle Management
- **Submit Jobs**: Post jobs with descriptions, rewards, and timeouts (30-2880 minutes)
- **Claim Jobs**: Workers can claim available jobs
- **Complete Jobs**: Submit work results and proof
- **Verify & Release**: Job submitters verify work and release payments
- **Job Rejection**: Ability to reject unsatisfactory work and make jobs available again
- **Storage Management**: Delete completed jobs to reclaim storage fees

### Job Status System
- `0` - **PENDING** (available for claiming)
- `1` - **CLAIMED** (worker assigned)
- `2` - **COMPLETED** (work done, pending verification)
- `3` - **VERIFIED** (payment released)

## 🔧 Smart Contract API Functions

### Core Transaction Functions
- `submit_job` - Post a new job with reward and timeout
- `claim_job` - Claim an available job as a worker
- `complete_job` - Submit work completion with results
- `verify_and_release` - Verify work and release payment to worker
- `reject_job` - Reject completed work and make job available again
- `delete_job` - Remove job to reclaim storage fees

### View Functions (Read-Only)
- `get_job_details` - Get comprehensive job information
- `get_pending_jobs_count` - Count of available jobs
- `get_pending_job_ids` - List of available job IDs
- `is_job_available` - Check if job can be claimed
- `is_job_expired` - Check if job has timed out

## 📊 Real-Time Events

The system emits events for real-time monitoring:
- `JobSubmitted` - New job posted
- `JobClaimed` - Job assigned to worker
- `JobCompleted` - Work submitted for verification
- `JobVerified` - Payment released to worker
- `JobRejected` - Work rejected, job made available again

## 🏗️ Project Structure

```
queue-monitor/          # Frontend monitoring dashboard
├── app/               # Next.js application
├── components/        # React components
└── utils/            # Blockchain integration services

smart_contracts/       # Sui Move smart contracts
├── sources/          # Contract source code
└── tests/           # Contract tests

nodejs-test-client/    # Testing utilities
└── test scripts      # Automated testing tools
```

## 💡 Key Benefits

- **Trustless Payments**: Smart contract escrow ensures fair compensation
- **Decentralized**: No central authority controlling job assignments
- **Transparent**: All job states and transactions visible on blockchain
- **Flexible Timeouts**: Configurable job expiration (30 minutes to 48 hours)
- **Gas Efficient**: Optimized for low transaction costs on Sui
- **Event-Driven**: Real-time updates through blockchain events

## 🔍 API Documentation

For detailed implementation examples and complete API reference, see:
- [`queue-monitor/API_DOCUMENTATION_CONCISE.md`](queue-monitor/API_DOCUMENTATION_CONCISE.md)