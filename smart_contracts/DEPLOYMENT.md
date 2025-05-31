# Job Queue Smart Contract - Deployment Information

## Deployment Details
- **Network**: Sui Testnet
- **Transaction Digest**: `D19rMw6CdU8bDLA8GvpgAhRVEAHrdLzFNhvbXxhipzPY`
- **Deploy Address**: `0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de`
- **Deployment Date**: May 31, 2025
- **Status**: ✅ **UPDATED** - Optimized version deployed

## Contract Objects

### 📦 Package Information
- **Package ID**: `0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d`
- **Module Name**: `job_queue`
- **Version**: 1

### 🎯 Key Objects Created

#### 1. JobQueueManager (Shared Object)
- **Object ID**: `0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc`
- **Type**: `job_queue::JobQueueManager`
- **Ownership**: Shared (available to all users)
- **Purpose**: Main contract object managing all jobs and queues

#### 2. UpgradeCap (Owned Object)
- **Object ID**: `0x864671f234dc280693a030321081a0a900c3dbe7f278da7bf7abb358780bb767`
- **Type**: `package::UpgradeCap`
- **Owner**: `0xaa48fcc27ae97f7eeeb9c45959174ed0ab8e22233ba366e6e09cf42c919578de`
- **Purpose**: Allows upgrading the smart contract



## How to Interact with the Contract

### Submit a Job
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function submit_job \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
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
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function register_worker \
  --args "["my-queue"]" 10 300 \
  --gas-budget 10000000
```

### Get Queue Statistics
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function get_queue_stats \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
         "my-queue" \
  --gas-budget 1000000
```

### Get Treasury Balance
```bash
sui client call \
  --package 0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d \
  --module job_queue \
  --function get_treasury_balance \
  --args 0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc \
  --gas-budget 1000000
```

## Sui Explorer Links
- **Transaction**: https://testnet.suivision.xyz/txblock/D19rMw6CdU8bDLA8GvpgAhRVEAHrdLzFNhvbXxhipzPY
- **Package**: https://testnet.suivision.xyz/package/0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d
- **JobQueueManager**: https://testnet.suivision.xyz/object/0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc


