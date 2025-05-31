# Payment and Refund Logic Documentation

This document explains the comprehensive payment and refund logic implemented in the Job Queue Smart Contract to ensure users only pay when their jobs are successfully processed.

## Core Principle

**Users are only charged when their job is successfully completed. In all other scenarios, they receive a full refund of their staked SUI tokens.**

## Payment Scenarios

### 1. 💰 PAYMENT KEPT (User Charged)

**Job Completed Successfully**
- **Trigger**: `complete_job()` function called by worker
- **Action**: Stake remains in treasury as payment for successful service
- **Reason**: User received the service they paid for

```move
// Payment logic in complete_job function
job.status = JOB_STATUS_COMPLETED;
// Stake is kept in treasury as payment for successful job processing
```

## Refund Scenarios

### 2. 💸 FULL REFUND (User Not Charged)

#### a) Job Failed After Maximum Attempts
- **Trigger**: `fail_job()` called when `attempts >= max_attempts`
- **Action**: Full refund issued to job submitter
- **Reason**: Service could not be provided after exhausting all retry attempts

#### b) Job Cancelled by User
- **Trigger**: `cancel_job()` called by job submitter
- **Action**: Full refund issued immediately
- **Reason**: User no longer wants the service
- **Conditions**: Job must be in PENDING status

#### c) Job Expired (24-hour timeout)
- **Trigger**: `refund_expired_job()` called after 24 hours
- **Action**: Full refund issued to job submitter
- **Reason**: Service was not provided within reasonable time

#### d) Job Abandoned by Worker
- **Trigger**: `release_abandoned_job()` called when visibility timeout exceeded
- **Action**: Full refund if max attempts reached, otherwise retry
- **Reason**: Worker reserved job but failed to complete or report failure

#### e) Admin Emergency Refund
- **Trigger**: `admin_refund_job()` called by admin
- **Action**: Full refund issued with custom reason
- **Reason**: Emergency intervention (system issues, disputes, etc.)

### 3. 🔄 STAKE HELD FOR RETRY (Temporary Hold)

#### Job Failed But Has Remaining Attempts
- **Trigger**: `fail_job()` called when `attempts < max_attempts`
- **Action**: Stake held in treasury, job marked as PENDING for retry
- **Reason**: Another attempt will be made to provide the service
- **Final Outcome**: Either payment (if ultimately successful) or refund (if ultimately fails)

## Implementation Details

### Refund Function
```move
fun refund_stake(
    manager: &mut JobQueueManager,
    recipient: address,
    amount: u64,
    reason: String,
    ctx: &mut TxContext
) {
    // Check treasury has sufficient balance
    assert!(balance::value(&manager.treasury) >= amount, E_INSUFFICIENT_TREASURY);
    
    // Extract coins and transfer to recipient
    let refund_balance = balance::split(&mut manager.treasury, amount);
    let refund_coin = coin::from_balance(refund_balance, ctx);
    transfer::public_transfer(refund_coin, recipient);
}
```

### Events Emitted
All refunds emit a `StakeRefunded` event:
```move
public struct StakeRefunded has copy, drop {
    uuid: String,
    submitter: address,
    refund_amount: u64,
    reason: String,
}
```

## State Transitions

```
Job Submitted (Stake Collected)
    ↓
PENDING → RESERVED → COMPLETED (Payment Kept)
    ↓           ↓
    ↓           → FAILED → RETRY (if attempts < max)
    ↓                  ↓
    ↓                  → DLQ (Refund Issued)
    ↓
    → CANCELLED (Refund Issued)
    ↓
    → EXPIRED (Refund Issued)
```

## Security Considerations

1. **Treasury Balance**: Always check treasury has sufficient balance before refunding
2. **Authorization**: Only job submitter can cancel their own jobs
3. **Double Refund Prevention**: Jobs can only be refunded once (status checks prevent multiple refunds)
4. **Admin Controls**: Admin refunds are only allowed for non-completed jobs

## Testing Coverage

The test suite includes comprehensive scenarios:

- ✅ `test_payment_on_successful_completion()` - Verifies payment is kept for successful jobs
- ✅ `test_refund_on_job_failure()` - Verifies refund after max attempts
- ✅ `test_refund_on_job_cancellation()` - Verifies refund on user cancellation
- ✅ Additional tests for various refund scenarios

## Benefits

1. **Fair Pricing**: Users only pay for successful service delivery
2. **Risk Mitigation**: Users don't lose money due to system failures or worker issues
3. **Transparency**: All payments and refunds are tracked on-chain with events
4. **Flexibility**: Multiple refund mechanisms handle various failure scenarios
5. **Trust**: Clear, deterministic rules build user confidence in the system

This payment model ensures the job queue system is fair, transparent, and user-friendly while maintaining economic incentives for reliable service delivery.
