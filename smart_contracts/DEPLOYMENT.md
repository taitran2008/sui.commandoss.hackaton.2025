# Job Queue Smart Contract - Deployment Information

## Deployment Details
- **Network**: Sui Testnet
- **Transaction Digest**: `DitNgWPXNHRudCGHZnMUcyLk5EqzTYBzxfsjMekq5qW3`
- **Deploy Address**: `0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de`
- **Deployment Date**: May 31, 2025

## Contract Objects

### 📦 Package Information
- **Package ID**: `0x852067615d7d48665007249466e314c14f74e43ec6253a72e8a2f41eadad0fee`
- **Module Name**: `job_queue`
- **Version**: 1

### 🎯 Key Objects Created

#### 1. JobQueueManager (Shared Object)
- **Object ID**: `0x7a9da37b7c3a06d225899b9aaf5ac3c3d801a8a78c6013208a4c4c97c919fcfa`
- **Type**: `job_queue::JobQueueManager`
- **Ownership**: Shared (available to all users)
- **Purpose**: Main contract object managing all jobs and queues

#### 2. UpgradeCap (Owned Object)
- **Object ID**: `0x035d41dc7220269a919c6a93a7ede517a95aa304a63e8a9eb7298147ebf8e753`
- **Type**: `package::UpgradeCap`
- **Owner**: `0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de`
- **Purpose**: Allows upgrading the smart contract



## How to Interact with the Contract

### Submit a Job
```bash
sui client call \
  --package 0x852067615d7d48665007249466e314c14f74e43ec6253a72e8a2f41eadad0fee \
  --module job_queue \
  --function submit_job \
  --args 0x7a9da37b7c3a06d225899b9aaf5ac3c3d801a8a78c6013208a4c4c97c919fcfa \
         "unique-job-id" \
         "my-queue" \
         "job-payload-data" \
         [SUI_COIN_OBJECT_ID] \
         0x6 \
  --gas-budget 10000000
```

### Register as Worker
```bash
sui client call \
  --package 0x852067615d7d48665007249466e314c14f74e43ec6253a72e8a2f41eadad0fee \
  --module job_queue \
  --function register_worker \
  --args "["my-queue"]" 10 300 \
  --gas-budget 10000000
```

### Get Queue Statistics
```bash
sui client call \
  --package 0x852067615d7d48665007249466e314c14f74e43ec6253a72e8a2f41eadad0fee \
  --module job_queue \
  --function get_queue_stats \
  --args 0x7a9da37b7c3a06d225899b9aaf5ac3c3d801a8a78c6013208a4c4c97c919fcfa \
         "my-queue" \
  --gas-budget 1000000
```

## Sui Explorer Links
- **Transaction**: https://testnet.suivision.xyz/txblock/DitNgWPXNHRudCGHZnMUcyLk5EqzTYBzxfsjMekq5qW3
- **Package**: https://testnet.suivision.xyz/package/0x852067615d7d48665007249466e314c14f74e43ec6253a72e8a2f41eadad0fee
- **JobQueueManager**: https://testnet.suivision.xyz/object/0x7a9da37b7c3a06d225899b9aaf5ac3c3d801a8a78c6013208a4c4c97c919fcfa


