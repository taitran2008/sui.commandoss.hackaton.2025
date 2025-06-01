# Decentralized Job Queue System

A decentralized job queue system built on the Sui Blockchain, enabling trustless job posting, claiming, completion, and payment verification.

## 🌐 Live Deployments

- **Web2 Link**: https://dptm8b098wb3y.cloudfront.net/
- **Web3 Link (IPFS)**: 
  - http://k51qzi5uqu5dlm9k7sqk5b1s2v7ns2mbdrn9no1jdsoy1bli1c4ots18sp32ov.ipns.localhost:8080/
  - https://ipfs.golinky.me/
- **Share list job to your workers** append your wallet address to the URL: 
  - https://dptm8b098wb3y.cloudfront.net/?host=0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de

## 📦 Tech Stack:
- **Frontend**: Next.js, React, Tailwind CSS
- **Blockchain**: Sui Blockchain (Move smart contracts)
- **Testing**: Node.js
- **Deployment**: IPFS, CloudFront
- **Storage**: Sui Blockchain for job data and state management


## 📦 Tested Scenarios:

```plaintext
/**
 * Case 1: Complete Job Queue Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30-minute timeout)
 * 2. Bob claims the job and receives 30 minutes to complete it
 * 3. Bob finishes it in 5 minutes
 * 4. Alice checks the result and calls verify_and_release, transferring 0.1 SUI to Bob
 * 5. The job object is deleted → storage rebate issued
 */
```

```plaintext
/**
 * Case 2: Job Rejection and Reassignment Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30-minute timeout)
 * 2. Bob claims the job and receives 30 minutes to complete it
 * 3. Bob finishes it in 5 minutes
 * 4. Alice checks the result and rejects it
 * 5. Job becomes available again, and Carol claims it
 * 6. Carol receives 30 minutes to complete the job
 * 7. Carol finishes it in 5 minutes
 * 8. Alice checks the result and calls verify_and_release, transferring 0.1 SUI to Carol
 * 9. The job object is deleted → storage rebate issued
 */
```

```plaintext
/**
 * Case 3: Job Timeout and Reassignment Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30-minute timeout)
 * 2. Bob claims the job and receives 30 minutes to complete it
 * 3. Bob finishes it in 45 minutes — OVERTIME!
 * 4. Job is automatically rejected due to timeout
 * 5. Job becomes available again, and Carol claims it
 * 6. Carol receives 30 minutes to complete the job
 * 7. Carol finishes it in 5 minutes
 * 8. Alice checks the result and calls verify_and_release, transferring 0.1 SUI to Carol
 * 9. The job object is deleted → storage rebate issued
 */
```

```plaintext
/**
 * Case 4: Job Self-Verification and Cancellation Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30-minute timeout)
 * 2. Alice realizes she made a mistake and wants to cancel it
 * 3. Since only VERIFIED jobs can be deleted, Alice implements a "self-verification" workflow:
 *    a) Alice claims her own job
 *    b) Alice completes the job with a cancellation message
 *    c) Alice verifies and releases payment to herself
 *    d) Alice deletes the VERIFIED job to get storage rebate
 * 4. This demonstrates the proper way to cancel a job in the smart contract system
 */
```

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

## 🔧 Smart Contract API Functions

### Core Transaction Functions
- `submit_job` - Post a new job with reward and timeout
- `claim_job` - Claim an available job as a worker
- `complete_job` - Submit work completion with results
- `verify_and_release` - Verify work and release payment to worker
- `reject_job` - Reject completed work and make job available again
- `delete_job` - Remove job to reclaim storage fees



## 🏗️ Project Structure

```
queue-monitor/          # Frontend monitoring dashboard
├── app/               # Next.js application
├── components/        # React components
└── utils/            # Blockchain integration services

smart_contracts/       # Sui Move smart contracts
├── sources/          # Contract source code
└── tests/           # Contract tests

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