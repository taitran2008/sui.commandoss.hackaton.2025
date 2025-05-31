# Job Queue Smart Contract API Documentation

## Overview

The Job Queue Smart Contract provides a decentralized job processing system on Sui blockchain. This API documentation helps off-chain clients integrate with the deployed smart contract.

## Contract Information

- **Network**: Sui Testnet
- **Package ID**: `0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d`
- **Module Name**: `job_queue`
- **JobQueueManager Object ID**: `0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc`

## Core Concepts

### Payment & Refund Logic

The contract implements a fair payment system:

- **Payment**: Stake is kept when job completes successfully
- **Refund**: Stake is returned for failed jobs (max retries), cancelled jobs, expired jobs, or admin refunds
- **Retry**: Stake is held during retries, refunded if ultimately fails

### Job Status Flow

```
PENDING (0) → RESERVED (1) → COMPLETED (2) [Payment]
     ↓              ↓
CANCELLED     DLQ (4) [Refund]
[Refund]
```

## API Reference

### 1. Submit Job

Submit a new job to the queue with SUI staking for priority.

**Function**: `submit_job`

**Parameters**:
- `manager`: `&mut JobQueueManager` - The shared JobQueueManager object
- `uuid`: `String` - Unique identifier for the job
- `queue`: `String` - Queue name (max 255 chars)
- `payload`: `String` - Job data (max 4KB)
- `stake`: `Coin<SUI>` - SUI tokens to stake for priority
- `clock`: `&Clock` - System clock object (`0x6`)

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function submit_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "unique-job-id-123" \
         "image-processing" \
         "{\"action\":\"resize\",\"image_url\":\"https://example.com/image.jpg\"}" \
         0x[COIN_OBJECT_ID] \
         0x6 \
  --gas-budget 10000000
```

**TypeScript SDK Example**:
```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

const txb = new TransactionBlock();
const coin = txb.splitCoins(txb.gas, [txb.pure(1000000)]); // 1 SUI

txb.moveCall({
  target: `${PACKAGE_ID}::job_queue::submit_job`,
  arguments: [
    txb.object(MANAGER_OBJECT_ID),
    txb.pure("unique-job-id-123"),
    txb.pure("image-processing"),
    txb.pure(JSON.stringify({action: "resize", image_url: "https://example.com/image.jpg"})),
    coin,
    txb.object("0x6") // Clock
  ],
});
```

**Events Emitted**:
```move
JobSubmitted {
  uuid: String,
  queue: String,
  submitter: address,
  created_at: u64,
  priority_stake: u64
}
```

---

### 2. Register Worker

Register as a worker to process jobs from specific queues.

**Function**: `register_worker`

**Parameters**:
- `queues`: `vector<String>` - List of queue names to subscribe to
- `batch_size`: `u64` - Max jobs to fetch at once (1-50)
- `visibility_timeout`: `u64` - Seconds to reserve jobs

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function register_worker \
  --args "[\"image-processing\",\"data-analysis\"]" 10 300 \
  --gas-budget 10000000
```

**TypeScript SDK Example**:
```typescript
txb.moveCall({
  target: `${PACKAGE_ID}::job_queue::register_worker`,
  arguments: [
    txb.pure(["image-processing", "data-analysis"]),
    txb.pure(10), // batch_size
    txb.pure(300) // visibility_timeout in seconds
  ],
});
```

**Returns**: Creates a `WorkerSubscription` object owned by the caller.

---

### 3. Fetch Jobs

Fetch available jobs from a queue for processing.

**Function**: `fetch_jobs`

**Parameters**:
- `manager`: `&mut JobQueueManager`
- `subscription`: `&WorkerSubscription` - Worker's subscription object
- `queue_name`: `String` - Queue to fetch from
- `clock`: `&Clock`

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function fetch_jobs \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         0x[WORKER_SUBSCRIPTION_ID] \
         "image-processing" \
         0x6 \
  --gas-budget 5000000
```

**Returns**: `vector<String>` - List of job UUIDs reserved for processing

**Events Emitted**:
```move
JobReserved {
  uuid: String,
  queue: String,
  worker: address,
  reserved_at: u64
}
```

---

### 4. Complete Job

Mark a job as successfully completed.

**Function**: `complete_job`

**Parameters**:
- `manager`: `&mut JobQueueManager`
- `job_uuid`: `String` - UUID of the job to complete
- `clock`: `&Clock`

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function complete_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "unique-job-id-123" \
         0x6 \
  --gas-budget 5000000
```

**TypeScript SDK Example**:
```typescript
txb.moveCall({
  target: `${PACKAGE_ID}::job_queue::complete_job`,
  arguments: [
    txb.object(MANAGER_OBJECT_ID),
    txb.pure("unique-job-id-123"),
    txb.object("0x6")
  ],
});
```

**Payment**: The staked SUI is kept in the contract treasury as payment for successful job processing.

**Events Emitted**:
```move
JobCompleted {
  uuid: String,
  queue: String,
  worker: address,
  completed_at: u64
}
```

---

### 5. Fail Job

Mark a job as failed with an error message.

**Function**: `fail_job`

**Parameters**:
- `manager`: `&mut JobQueueManager`
- `job_uuid`: `String` - UUID of the failed job
- `error_message`: `String` - Description of the failure
- `clock`: `&Clock`

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function fail_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "unique-job-id-123" \
         "Image processing timeout" \
         0x6 \
  --gas-budget 5000000
```

**Refund Logic**:
- If max attempts reached: Job moves to DLQ and stake is refunded
- If attempts remaining: Job becomes available for retry

**Events Emitted**:
```move
JobFailed {
  uuid: String,
  queue: String,
  worker: address,
  attempts: u16,
  error_message: String,
  moved_to_dlq: bool
}

// If refunded:
StakeRefunded {
  uuid: String,
  submitter: address,
  refund_amount: u64,
  reason: String
}
```

---

### 6. Get Job Details

Retrieve detailed information about a specific job.

**Function**: `get_job` (view function)

**Parameters**:
- `manager`: `&JobQueueManager`
- `job_uuid`: `String`

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function get_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "unique-job-id-123" \
  --gas-budget 1000000
```

**Returns**: Job object with fields:
- `uuid`: String
- `queue`: String
- `payload`: String
- `attempts`: u16
- `status`: u8 (0=Pending, 1=Reserved, 2=Completed, 4=DLQ)
- `submitter`: address
- `priority_stake`: u64
- `created_at`: u64
- `available_at`: u64
- `reserved_at`: Option<u64>
- `error_message`: Option<String>

---

### 7. Get Queue Statistics

Get statistics for a specific queue.

**Function**: `get_queue_stats` (view function)

**Parameters**:
- `manager`: `&JobQueueManager`
- `queue_name`: `String`

**CLI Command**:
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function get_queue_stats \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "image-processing" \
  --gas-budget 1000000
```

**Returns**: `(u64, u64)` - (total_jobs, pending_jobs)

---

### 8. Admin Functions

#### Admin Refund
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function admin_refund_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "unique-job-id-123" \
         "Emergency refund due to system maintenance" \
  --gas-budget 5000000
```

## Integration Examples

### Worker Service (TypeScript)

```typescript
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

class JobWorker {
  constructor(
    private client: SuiClient,
    private workerKeypair: any,
    private subscriptionId: string
  ) {}

  async processJobs(queueName: string) {
    // 1. Fetch jobs
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::job_queue::fetch_jobs`,
      arguments: [
        txb.object(MANAGER_OBJECT_ID),
        txb.object(this.subscriptionId),
        txb.pure(queueName),
        txb.object("0x6")
      ],
    });

    const result = await this.client.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: this.workerKeypair,
    });

    // Parse job UUIDs from result
    const jobUuids = this.parseJobUuids(result);

    // 2. Process each job
    for (const jobUuid of jobUuids) {
      try {
        await this.processJob(jobUuid);
        await this.completeJob(jobUuid);
      } catch (error) {
        await this.failJob(jobUuid, error.message);
      }
    }
  }

  private async completeJob(jobUuid: string) {
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::job_queue::complete_job`,
      arguments: [
        txb.object(MANAGER_OBJECT_ID),
        txb.pure(jobUuid),
        txb.object("0x6")
      ],
    });

    await this.client.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      signer: this.workerKeypair,
    });
  }
}
```

### Job Submitter (Python)

```python
from pysui import SuiClient, SuiConfig
from pysui.sui.sui_txn import SuiTransaction

class JobSubmitter:
    def __init__(self, client: SuiClient, keypair):
        self.client = client
        self.keypair = keypair
    
    async def submit_job(self, job_id: str, queue: str, payload: dict, stake_amount: int):
        txn = SuiTransaction(client=self.client)
        
        # Split gas for stake
        coin = txn.split_coin(
            coin=txn.gas,
            amounts=[stake_amount]
        )
        
        # Submit job
        txn.move_call(
            target=f"{PACKAGE_ID}::job_queue::submit_job",
            arguments=[
                MANAGER_OBJECT_ID,
                job_id,
                queue,
                json.dumps(payload),
                coin,
                "0x6"  # Clock
            ]
        )
        
        result = await txn.execute(
            signer=self.keypair,
            gas_budget=10_000_000
        )
        
        return result
```

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | `E_INVALID_PAYLOAD_SIZE` | Payload exceeds 4KB limit |
| 2 | `E_INVALID_QUEUE_NAME` | Queue name empty or exceeds 255 chars |
| 3 | `E_JOB_NOT_FOUND` | Job UUID doesn't exist |
| 7 | `E_INVALID_BATCH_SIZE` | Batch size not between 1-50 |
| 8 | `E_UNAUTHORIZED_ACCESS` | Worker not subscribed to queue |
| 9 | `E_INSUFFICIENT_TREASURY` | Not enough funds for refund |
| 10 | `E_UNAUTHORIZED_REFUND` | Cannot refund completed job |

## Constants

| Name | Value | Description |
|------|-------|-------------|
| `MAX_PAYLOAD_SIZE` | 4096 | Maximum job payload size in bytes |
| `MAX_QUEUE_NAME_LENGTH` | 255 | Maximum queue name length |
| `MAX_BATCH_SIZE` | 50 | Maximum jobs per fetch |
| `DEFAULT_VISIBILITY_TIMEOUT` | 300 | Default job reservation time (5 min) |
| `DEFAULT_MAX_ATTEMPTS` | 3 | Default retry attempts before DLQ |

## Best Practices

1. **Job IDs**: Use UUIDs or timestamp-based IDs to ensure uniqueness
2. **Payload Size**: Keep payloads under 4KB; use external storage for large data
3. **Error Handling**: Always implement proper error handling in workers
4. **Monitoring**: Monitor job status and queue depths regularly
5. **Staking**: Stake appropriate amounts based on job priority and value
6. **Timeouts**: Set reasonable visibility timeouts based on job complexity

## Monitoring & Analytics

### Event Listening

Monitor these events for system observability:

```typescript
// Listen for job submissions
client.subscribeEvent({
  filter: {
    Package: PACKAGE_ID,
    EventType: `${PACKAGE_ID}::job_queue::JobSubmitted`
  },
  onMessage: (event) => {
    console.log('New job submitted:', event.parsedJson);
  }
});
```

### Queue Health Check

```bash
# Check queue statistics
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function get_queue_stats \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "your-queue-name" \
  --gas-budget 1000000
```

## Support

- **Explorer**: https://testnet.suivision.xyz/package/0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d
- **Source Code**: Available in the smart_contracts repository
- **Network**: Sui Testnet
