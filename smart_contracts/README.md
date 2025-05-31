# Job Queue System - Sui Smart Contract

A decentralized job queue system built on Sui blockchain that enables efficient job processing through prioritization, worker subscriptions, and robust error handling.

## Overview

This smart contract implements a sophisticated job queue system with the following key features:

- **On-chain Job Storage**: Jobs are stored as immutable on-chain objects
- **Priority System**: Jobs prioritized by SUI stake amount, then FIFO by creation time
- **Worker Subscriptions**: Workers can subscribe to specific queues and fetch jobs in batches
- **Error Handling**: Comprehensive retry mechanism with Dead Letter Queue (DLQ)
- **Visibility Timeout**: Prevents job duplication during processing
- **Fair Payment Model**: Users only pay when jobs are successfully processed

## 💰 Payment & Refund System

**Core Principle**: Users are only charged when their job is successfully completed. All other scenarios result in full refunds.

- ✅ **Payment**: Stake kept only when job completes successfully
- 💸 **Refund**: Full refund for failures, cancellations, expiry, or abandonment
- 🔄 **Retry**: Stake held temporarily during retry attempts

📖 **[Detailed Payment & Refund Documentation](./PAYMENT_REFUND_LOGIC.md)**

## Quick Start

### Job Submission
```move
job_queue::submit_job(
    &mut manager,
    string::utf8(b"unique-job-id"),
    string::utf8(b"queue-name"),
    string::utf8(b"job-payload"),
    stake_coin,
    &clock,
    ctx
);
```

### Worker Registration
```move
job_queue::register_worker(
    vector[string::utf8(b"queue-name")],
    10, // batch size
    300, // visibility timeout in seconds
    ctx
);
```

### Job Processing
```move
// Fetch jobs
let jobs = job_queue::fetch_jobs(&mut manager, &subscription, queue_name, &clock, ctx);

// Complete job
job_queue::complete_job(&mut manager, job_uuid, &clock, ctx);

// Or mark as failed
job_queue::fail_job(&mut manager, job_uuid, error_message, &clock, ctx);
```

## Architecture

The system consists of three main components:

1. **JobQueueManager**: Central contract managing all jobs and queues
2. **Job**: Individual job objects with metadata and payload
3. **WorkerSubscription**: Worker registration for queue access

## Job States

- **PENDING** (0): Available for workers to fetch
- **RESERVED** (1): Currently being processed by a worker
- **COMPLETED** (2): Successfully processed
- **DLQ** (4): Failed after maximum retry attempts

## Visual Documentation

For detailed system flows and architecture diagrams, see [job_queue_flowchart.md](./job_queue_flowchart.md).

## Testing

Run the test suite:
```bash
sui move test
```

## Building

Build the contract:
```bash
sui move build
```

## Error Codes

- `E_INVALID_PAYLOAD_SIZE` (1): Job payload exceeds 4KB limit
- `E_INVALID_QUEUE_NAME` (2): Queue name invalid or too long
- `E_JOB_NOT_FOUND` (3): Job UUID not found
- `E_INVALID_BATCH_SIZE` (7): Batch size invalid or exceeds limit
- `E_UNAUTHORIZED_ACCESS` (8): Worker not subscribed to queue

## Constants

- `MAX_PAYLOAD_SIZE`: 4096 bytes (4KB)
- `MAX_QUEUE_NAME_LENGTH`: 255 characters
- `MAX_BATCH_SIZE`: 50 jobs per fetch
- `DEFAULT_VISIBILITY_TIMEOUT`: 300 seconds (5 minutes)
- `DEFAULT_MAX_ATTEMPTS`: 3 retry attempts