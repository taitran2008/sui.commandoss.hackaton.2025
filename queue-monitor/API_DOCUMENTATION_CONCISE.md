# SUI Job Queue Contract - Developer API

## Quick Start

**Package ID**: `0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383`  
**Manager ID**: `0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458`  
**Clock ID**: `0x6` (system clock)

```javascript
// Basic setup
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const PACKAGE_ID = '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383';
const MANAGER_ID = '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458';
const CLOCK_ID = '0x6';
```

## Job Status
- `0` - PENDING (available for claiming)
- `1` - CLAIMED (worker assigned)
- `2` - COMPLETED (work done, pending verification)
- `3` - VERIFIED (payment released)

## Core Functions

### 1. Submit Job
```javascript
const txb = new Transaction();
const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(100000000)]); // 0.1 SUI
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::submit_job`,
    arguments: [
        txb.object(MANAGER_ID),
        txb.pure.string("Job description"),
        coin,
        txb.pure.u64(30), // timeout in minutes (30-2880)
        txb.object(CLOCK_ID),
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
        txb.object(CLOCK_ID),
    ],
});
```

### 3. Complete Job
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::complete_job`,
    arguments: [
        txb.object(jobId),
        txb.pure.string("Work result/proof"),
        txb.object(CLOCK_ID),
    ],
});
```

### 4. Verify & Release Payment
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::verify_and_release`,
    arguments: [
        txb.object(jobId),
        txb.object(CLOCK_ID),
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
        txb.pure.string("Rejection reason"),
        txb.object(CLOCK_ID),
    ],
});
```

### 6. Delete Job (for storage rebate)
```javascript
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::delete_job`,
    arguments: [
        txb.object(jobId),
    ],
});
```

## View Functions

### Get Job Details
```javascript
// Returns: [description, reward_amount, submitter, worker, result, status]
const txb = new Transaction();
txb.moveCall({
    target: `${PACKAGE_ID}::job_queue::get_job_details`,
    arguments: [txb.object(jobId)],
});

const result = await client.devInspectTransactionBlock({
    transactionBlock: txb,
    sender: address,
});
```

### Get Pending Jobs
```javascript
// Get pending job count
const countTxb = new Transaction();
countTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::get_pending_jobs_count`,
    arguments: [countTxb.object(MANAGER_ID)],
});

// Get pending job IDs
const idsTxb = new Transaction();
idsTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::get_pending_job_ids`,
    arguments: [idsTxb.object(MANAGER_ID)],
});
```

### Check Job Status
```javascript
// Check if job is available for claiming
const availableTxb = new Transaction();
availableTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::is_job_available`,
    arguments: [availableTxb.object(jobId)],
});

// Check if job is expired
const expiredTxb = new Transaction();
expiredTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::is_job_expired`,
    arguments: [expiredTxb.object(jobId), expiredTxb.object(CLOCK_ID)],
});
```



## Important Notes

- **Timeout Range**: Job timeout must be between 30 and 2880 minutes (30 minutes to 48 hours)
- **Reward Amount**: Specified in MIST (1 SUI = 1,000,000,000 MIST)
- **Transaction Options**: Always include `showEffects: true, showEvents: true` for debugging
- **Job States**: PENDING → CLAIMED → COMPLETED → VERIFIED (or REJECTED back to PENDING)
- **Storage Rebate**: Delete completed jobs to reclaim storage costs
- **Event Monitoring**: Subscribe to package events for real-time job updates

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
const submitTxb = new Transaction();
const [coin] = submitTxb.splitCoins(submitTxb.gas, [submitTxb.pure.u64(100000000)]); // 0.1 SUI
submitTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::submit_job`,
    arguments: [
        submitTxb.object(MANAGER_ID),
        submitTxb.pure.string("Job description"),
        coin,
        submitTxb.pure.u64(30), // 30 minutes timeout
        submitTxb.object(CLOCK_ID),
    ],
});

const submitTx = await client.signAndExecuteTransaction({
    transaction: submitTxb,
    signer: submitterKeypair,
    options: { showEffects: true, showEvents: true },
});

// 2. Worker claims job
const claimTxb = new Transaction();
claimTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::claim_job`,
    arguments: [
        claimTxb.object(MANAGER_ID),
        claimTxb.object(jobId),
        claimTxb.object(CLOCK_ID),
    ],
});

const claimTx = await client.signAndExecuteTransaction({
    transaction: claimTxb,
    signer: workerKeypair,
    options: { showEffects: true, showEvents: true },
});

// 3. Worker completes job
const completeTxb = new Transaction();
completeTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::complete_job`,
    arguments: [
        completeTxb.object(jobId),
        completeTxb.pure.string("Work result"),
        completeTxb.object(CLOCK_ID),
    ],
});

const completeTx = await client.signAndExecuteTransaction({
    transaction: completeTxb,
    signer: workerKeypair,
    options: { showEffects: true, showEvents: true },
});

// 4. Submitter verifies and releases payment
const verifyTxb = new Transaction();
verifyTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::verify_and_release`,
    arguments: [
        verifyTxb.object(jobId),
        verifyTxb.object(CLOCK_ID),
    ],
});

const verifyTx = await client.signAndExecuteTransaction({
    transaction: verifyTxb,
    signer: submitterKeypair,
    options: { showEffects: true, showEvents: true },
});

// 5. Delete job for storage rebate
const deleteTxb = new Transaction();
deleteTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::delete_job`,
    arguments: [deleteTxb.object(jobId)],
});

const deleteTx = await client.signAndExecuteTransaction({
    transaction: deleteTxb,
    signer: submitterKeypair,
    options: { showEffects: true, showEvents: true },
});
```

## Job Rejection Workflow

When a job submitter is not satisfied with the work quality, they can reject the job and make it available for other workers:

```javascript
// 1. Submitter reviews work and decides to reject
const rejectTxb = new Transaction();
rejectTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::reject_job`,
    arguments: [
        rejectTxb.object(MANAGER_ID),
        rejectTxb.object(jobId),
        rejectTxb.pure.string("Poor quality work, does not meet requirements"),
        rejectTxb.object(CLOCK_ID),
    ],
});

const rejectTx = await client.signAndExecuteTransaction({
    transaction: rejectTxb,
    signer: submitterKeypair,
    options: { showEffects: true, showEvents: true },
});

// 2. Job becomes available again for other workers to claim
// (The job status is reset to PENDING and added back to the pending queue)

// 3. New worker can claim the job
const newClaimTxb = new Transaction();
newClaimTxb.moveCall({
    target: `${PACKAGE_ID}::job_queue::claim_job`,
    arguments: [
        newClaimTxb.object(MANAGER_ID),
        newClaimTxb.object(jobId),
        newClaimTxb.object(CLOCK_ID),
    ],
});
```

## Helper Functions

```javascript
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { fromBase64 } = require('@mysten/sui/utils');
const fs = require('fs');
const path = require('path');

// Get job object ID from transaction result
function getJobId(txResult) {
    if (txResult.effects && txResult.effects.created) {
        const jobObject = txResult.effects.created.find(obj => 
            obj.owner && typeof obj.owner === 'object' && obj.owner.Shared
        );
        return jobObject?.reference?.objectId;
    }
    return null;
}

// Check transaction status
function isTransactionSuccessful(txResult) {
    return txResult.effects?.status?.status === 'success';
}

// Get SUI balance
async function getSuiBalance(address) {
    const balance = await client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
    });
    return Number(balance.totalBalance) / 1000000000; // Convert MIST to SUI
}

// Load wallet from file
function loadWallet(walletName) {
    const walletDir = path.join('./wallets', walletName);
    const files = fs.readdirSync(walletDir);
    const addressFile = files.find(f => f.startsWith('0x'));
    
    if (!addressFile) {
        throw new Error(`No address file found in wallet ${walletName}`);
    }
    
    const privateKeyB64 = fs.readFileSync(path.join(walletDir, addressFile), 'utf8').trim();
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKeyB64));
    
    return {
        keypair,
        address: addressFile
    };
}
```
