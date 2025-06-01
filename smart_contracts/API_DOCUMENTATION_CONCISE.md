# SUI Job Queue Contract - Developer API

## Quick Start

**Package ID**: `0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383`  
**Manager ID**: `0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458`  
**Clock ID**: `0x6` (system clock)

```javascript
// Basic setup
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const PACKAGE_ID = '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383';
const MANAGER_ID = '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458';
```

## Job Status
- `0` - PENDING (available for claiming)
- `1` - CLAIMED (worker assigned)
- `2` - COMPLETED (work done, pending verification)
- `3` - VERIFIED (payment released)

## Core Functions

### 1. Submit Job
```javascript
const txb = new TransactionBlock();
const [coin] = txb.splitCoins(txb.gas, [txb.pure(1000000000)]); // 1 SUI
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::submit_job`,
    arguments: [
        txb.object(MANAGER_ID),
        txb.pure("Job description"),
        coin,
        txb.pure(720), // timeout in minutes (30-2880)
        txb.object('0x6'), // clock
    ],
});
```

### 2. Claim Job
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::claim_job`,
    arguments: [
        txb.object(MANAGER_ID),
        txb.object(jobId),
        txb.object('0x6'), // clock
    ],
});
```

### 3. Complete Job
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::complete_job`,
    arguments: [
        txb.object(jobId),
        txb.pure("Work result/proof"),
        txb.object('0x6'), // clock
    ],
});
```

### 4. Verify & Release Payment
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::verify_and_release`,
    arguments: [
        txb.object(jobId),
        txb.object('0x6'), // clock
    ],
});
```

### 5. Reject Job
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::reject_job`,
    arguments: [
        txb.object(MANAGER_ID),
        txb.object(jobId),
        txb.pure("Rejection reason"),
        txb.object('0x6'), // clock
    ],
});
```

## View Functions

### Get Job Details
```javascript
// Returns: [description, reward_amount, submitter, worker, result, status]
const result = await client.devInspectTransactionBlock({
    transactionBlock: txb,
    sender: address,
});
```

### Get Pending Jobs
```javascript
// Get pending job count
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::get_pending_jobs_count`,
    arguments: [txb.object(MANAGER_ID)],
});

// Get pending job IDs
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::get_pending_job_ids`,
    arguments: [txb.object(MANAGER_ID)],
});
```

### Check Job Status
```javascript
// Check if job is available for claiming
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::is_job_available`,
    arguments: [txb.object(jobId)],
});

// Check if job is expired
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::is_job_expired`,
    arguments: [txb.object(jobId), txb.object('0x6')],
});
```

## Events

Listen to these events for real-time updates:

```javascript
// Subscribe to job events
const unsubscribe = await client.subscribeEvent({
    filter: { Package: PACKAGE_ID },
    onMessage: (event) => {
        const eventType = event.type.split('::').pop();
        switch (eventType) {
            case 'JobSubmitted':
                // { job_id, description, reward_amount, submitter, timestamp }
                break;
            case 'JobClaimed':
                // { job_id, worker, timestamp }
                break;
            case 'JobCompleted':
                // { job_id, worker, result, timestamp }
                break;
            case 'JobVerified':
                // { job_id, worker, reward_amount, timestamp }
                break;
            case 'JobRejected':
                // { job_id, worker, reason, timestamp }
                break;
        }
    },
});
```

## Error Codes
- `2` - Job already claimed
- `3` - Not the job claimer
- `4` - Job not completed
- `5` - Not the job submitter
- `7` - Empty description
- `8` - Job expired
- `9` - Invalid timeout (must be 30-2880 minutes)

## Example Workflow

```javascript
// 1. Submit job
const submitTx = await client.signAndExecuteTransactionBlock({
    transactionBlock: submitJobTxb,
    signer: submitterKeypair,
});

// 2. Worker claims job
const claimTx = await client.signAndExecuteTransactionBlock({
    transactionBlock: claimJobTxb,
    signer: workerKeypair,
});

// 3. Worker completes job
const completeTx = await client.signAndExecuteTransactionBlock({
    transactionBlock: completeJobTxb,
    signer: workerKeypair,
});

// 4. Submitter verifies and releases payment
const verifyTx = await client.signAndExecuteTransactionBlock({
    transactionBlock: verifyJobTxb,
    signer: submitterKeypair,
});
```

## Helper Functions

```javascript
// Get job object from transaction result
function getJobId(txResult) {
    return txResult.effects.created?.[0]?.reference?.objectId;
}

// Check transaction status
function isTransactionSuccessful(txResult) {
    return txResult.effects.status.status === 'success';
}
```
