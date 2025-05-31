/// Module: Job Queue System
/// 
/// A decentralized job queue system that stores jobs as on-chain objects
/// and supports efficient processing by workers through named queues,
/// prioritization, and error handling mechanisms.
/// 
/// ## Payment/Refund Logic:
/// Users stake SUI tokens when submitting jobs. The payment logic is designed to be fair:
/// 
/// **PAYMENT (Stake Kept):**
/// - Job completed successfully → User pays the staked amount as fee for service
/// 
/// **REFUND (Stake Returned):**
/// - Job fails after max retry attempts → Full refund (service couldn't be provided)
/// - Job cancelled by user (pending status) → Full refund (service not requested)
/// - Job expires after 24 hours without processing → Full refund (service not provided)
/// - Job abandoned by worker (visibility timeout exceeded) → Full refund if max attempts reached
/// - Admin emergency refund → Full refund (admin intervention)
/// 
/// **RETRY (Stake Held):**
/// - Job fails but has remaining attempts → Stake held for retry, refunded if ultimately fails
/// - Job abandoned but has remaining attempts → Stake held for retry, refunded if ultimately fails
/// 
/// This ensures users only pay when their job is successfully processed.
module smart_contracts::job_queue {
    use std::string::{Self, String};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::balance::{Self, Balance};

    // Error codes
    const E_INVALID_PAYLOAD_SIZE: u64 = 1;
    const E_INVALID_QUEUE_NAME: u64 = 2;
    const E_JOB_NOT_FOUND: u64 = 3;
    const E_INVALID_BATCH_SIZE: u64 = 7;
    const E_UNAUTHORIZED_ACCESS: u64 = 8;
    const E_INSUFFICIENT_TREASURY: u64 = 9;
    const E_UNAUTHORIZED_REFUND: u64 = 10;

    // Constants
    const MAX_PAYLOAD_SIZE: u64 = 4096; // 4KB
    const MAX_QUEUE_NAME_LENGTH: u64 = 255;
    const MAX_BATCH_SIZE: u64 = 50;
    const DEFAULT_VISIBILITY_TIMEOUT: u64 = 300; // 5 minutes in seconds
    const DEFAULT_MAX_ATTEMPTS: u64 = 3;

    // Job status enumeration
    const JOB_STATUS_PENDING: u8 = 0;
    const JOB_STATUS_RESERVED: u8 = 1;
    const JOB_STATUS_COMPLETED: u8 = 2;
    const JOB_STATUS_DLQ: u8 = 4;

    /// Job object stored on-chain
    public struct Job has key, store {
        id: UID,
        uuid: String,
        queue: String,
        payload: String,
        attempts: u16,
        reserved_at: Option<u64>,
        available_at: u64,
        created_at: u64,
        status: u8,
        error_message: Option<String>,
        submitter: address,
        priority_stake: u64,
    }

    /// Job Queue Manager - main contract object
    public struct JobQueueManager has key {
        id: UID,
        jobs: Table<String, Job>, // uuid -> Job
        queue_jobs: Table<String, vector<String>>, // queue_name -> job_uuids
        total_jobs: u64,
        visibility_timeout: u64,
        max_attempts: u64,
        treasury: Balance<SUI>,
    }

    /// Worker registration for queue subscription
    public struct WorkerSubscription has key {
        id: UID,
        worker: address,
        subscribed_queues: vector<String>,
        batch_size: u64,
        visibility_timeout: u64,
    }

    // Events
    public struct JobSubmitted has copy, drop {
        uuid: String,
        queue: String,
        submitter: address,
        created_at: u64,
        priority_stake: u64,
    }

    public struct JobReserved has copy, drop {
        uuid: String,
        queue: String,
        worker: address,
        reserved_at: u64,
    }

    public struct JobCompleted has copy, drop {
        uuid: String,
        queue: String,
        worker: address,
        completed_at: u64,
    }

    public struct JobFailed has copy, drop {
        uuid: String,
        queue: String,
        worker: address,
        attempts: u16,
        error_message: String,
        moved_to_dlq: bool,
    }

    public struct StakeRefunded has copy, drop {
        uuid: String,
        submitter: address,
        refund_amount: u64,
        reason: String,
    }

    /// Initialize the job queue system
    fun init(ctx: &mut TxContext) {
        let manager = JobQueueManager {
            id: object::new(ctx),
            jobs: table::new(ctx),
            queue_jobs: table::new(ctx),
            total_jobs: 0,
            visibility_timeout: DEFAULT_VISIBILITY_TIMEOUT,
            max_attempts: DEFAULT_MAX_ATTEMPTS,
            treasury: balance::zero(),
        };
        transfer::share_object(manager);
    }

    /// Test initialization function for testing
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }

    /// Submit a new job to the queue with SUI staking for priority
    public entry fun submit_job(
        manager: &mut JobQueueManager,
        uuid: String,
        queue: String,
        payload: String,
        stake: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(string::length(&payload) <= MAX_PAYLOAD_SIZE, E_INVALID_PAYLOAD_SIZE);
        assert!(string::length(&queue) <= MAX_QUEUE_NAME_LENGTH, E_INVALID_QUEUE_NAME);
        assert!(!string::is_empty(&queue), E_INVALID_QUEUE_NAME);

        let stake_amount = coin::value(&stake);
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let submitter = tx_context::sender(ctx);

        // Add stake to treasury
        balance::join(&mut manager.treasury, coin::into_balance(stake));

        // Store values before creating job to avoid move issues
        let job_uuid = uuid;
        let job_queue = queue;

        // Create job
        let job = Job {
            id: object::new(ctx),
            uuid: job_uuid,
            queue: job_queue,
            payload: payload,
            attempts: 0,
            reserved_at: option::none(),
            available_at: current_time,
            created_at: current_time,
            status: JOB_STATUS_PENDING,
            error_message: option::none(),
            submitter: submitter,
            priority_stake: stake_amount,
        };

        // Add job to manager
        table::add(&mut manager.jobs, job_uuid, job);
        
        // Add job to queue
        if (!table::contains(&manager.queue_jobs, job_queue)) {
            table::add(&mut manager.queue_jobs, job_queue, vector::empty());
        };
        let queue_jobs = table::borrow_mut(&mut manager.queue_jobs, job_queue);
        vector::push_back(queue_jobs, job_uuid);

        manager.total_jobs = manager.total_jobs + 1;

        // Emit event
        event::emit(JobSubmitted {
            uuid: job_uuid,
            queue: job_queue,
            submitter: submitter,
            created_at: current_time,
            priority_stake: stake_amount,
        });
    }

    /// Register worker for queue subscription
    public entry fun register_worker(
        queues: vector<String>,
        batch_size: u64,
        visibility_timeout: u64,
        ctx: &mut TxContext
    ) {
        assert!(batch_size > 0 && batch_size <= MAX_BATCH_SIZE, E_INVALID_BATCH_SIZE);
        
        let subscription = WorkerSubscription {
            id: object::new(ctx),
            worker: tx_context::sender(ctx),
            subscribed_queues: queues,
            batch_size: batch_size,
            visibility_timeout: visibility_timeout,
        };
        transfer::transfer(subscription, tx_context::sender(ctx));
    }

    /// Fetch jobs from subscribed queues (batch processing)
    public fun fetch_jobs(
        manager: &mut JobQueueManager,
        subscription: &WorkerSubscription,
        queue_name: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): vector<String> {
        assert!(vector::contains(&subscription.subscribed_queues, &queue_name), E_UNAUTHORIZED_ACCESS);
        
        let current_time = clock::timestamp_ms(clock) / 1000;
        let worker = tx_context::sender(ctx);
        let mut fetched_jobs = vector::empty<String>();
        
        if (!table::contains(&manager.queue_jobs, queue_name)) {
            return fetched_jobs
        };

        let queue_jobs = table::borrow_mut(&mut manager.queue_jobs, queue_name);
        let mut fetched_count = 0;
        
        // For now, we'll implement a simple priority system
        // In a production system, we'd implement a more sophisticated priority queue
        let mut highest_stake = 0;
        
        // First pass: find the highest stake amount
        let mut i = 0;
        while (i < vector::length(queue_jobs)) {
            let job_uuid = *vector::borrow(queue_jobs, i);
            
            if (table::contains(&manager.jobs, job_uuid)) {
                let job = table::borrow(&manager.jobs, job_uuid);
                
                if (is_job_available(job, current_time)) {
                    if (job.priority_stake > highest_stake) {
                        highest_stake = job.priority_stake;
                    }
                }
            };
            i = i + 1;
        };
        
        // Second pass: collect jobs with highest stake, sorted by creation time
        i = 0;
        while (i < vector::length(queue_jobs) && fetched_count < subscription.batch_size) {
            let job_uuid = *vector::borrow(queue_jobs, i);
            
            if (table::contains(&manager.jobs, job_uuid)) {
                let job = table::borrow_mut(&mut manager.jobs, job_uuid);
                
                // Check if job is available and has highest stake
                if (is_job_available(job, current_time) && job.priority_stake == highest_stake) {
                    // Store job info before reservation
                    let job_uuid_copy = job.uuid;
                    let job_queue_copy = job.queue;
                    
                    // Reserve the job
                    job.status = JOB_STATUS_RESERVED;
                    job.reserved_at = option::some(current_time);
                    
                    vector::push_back(&mut fetched_jobs, job_uuid);
                    fetched_count = fetched_count + 1;
                    
                    // Emit event
                    event::emit(JobReserved {
                        uuid: job_uuid_copy,
                        queue: job_queue_copy,
                        worker: worker,
                        reserved_at: current_time,
                    });
                }
            };
            i = i + 1;
        };
        
        fetched_jobs
    }

    /// Mark job as completed - stake is kept as payment for successful processing
    public entry fun complete_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let job = table::borrow_mut(&mut manager.jobs, job_uuid);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let worker = tx_context::sender(ctx);
        
        // Verify job is reserved
        assert!(job.status == JOB_STATUS_RESERVED, E_JOB_NOT_FOUND);
        
        // Store values before mutations
        let job_uuid_copy = job.uuid;
        let job_queue_copy = job.queue;
        
        // Mark as completed
        job.status = JOB_STATUS_COMPLETED;
        
        // PAYMENT: Stake is kept in treasury as payment for successful job processing
        // This is the only case where the user's stake is not refunded
        // The stake serves as payment for the successful completion of the job
        
        // Remove from queue (after releasing the mutable borrow)
        remove_job_from_queue(manager, &job_queue_copy, &job_uuid);
        
        // Emit event
        event::emit(JobCompleted {
            uuid: job_uuid_copy,
            queue: job_queue_copy,
            worker: worker,
            completed_at: current_time,
        });
    }

    /// Mark job as failed with error message and refund stake appropriately
    public entry fun fail_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        error_message: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let job = table::borrow_mut(&mut manager.jobs, job_uuid);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let worker = tx_context::sender(ctx);
        
        // Verify job is reserved
        assert!(job.status == JOB_STATUS_RESERVED, E_JOB_NOT_FOUND);
        
        // Store values before mutations to avoid borrow checker issues
        let job_queue_copy = job.queue;
        let job_uuid_copy = job.uuid;
        let initial_attempts = job.attempts;
        let submitter = job.submitter;
        let stake_amount = job.priority_stake;
        
        // Increment attempts
        job.attempts = job.attempts + 1;
        job.error_message = option::some(error_message);
        job.reserved_at = option::none();
        
        let mut moved_to_dlq = false;
        
        // Check if max attempts exceeded
        if (job.attempts >= (manager.max_attempts as u16)) {
            // Move to DLQ and refund the user since job failed permanently
            job.status = JOB_STATUS_DLQ;
            moved_to_dlq = true;
            
            // REFUND: Job failed permanently after all retry attempts
            refund_stake(manager, submitter, stake_amount, string::utf8(b"Job moved to DLQ after max attempts"), ctx);
            
            // Emit refund event
            event::emit(StakeRefunded {
                uuid: job_uuid_copy,
                submitter: submitter,
                refund_amount: stake_amount,
                reason: string::utf8(b"Job moved to DLQ after max attempts"),
            });
        } else {
            // Make available for retry - keep stake for potential retry
            // NOTE: Stake remains in treasury until job either succeeds or exhausts all attempts
            job.status = JOB_STATUS_PENDING;
            job.available_at = current_time;
        };
        
        // Remove from queue if moved to DLQ (after releasing the mutable borrow)
        if (moved_to_dlq) {
            remove_job_from_queue(manager, &job_queue_copy, &job_uuid_copy);
        };
        
        // Emit event
        event::emit(JobFailed {
            uuid: job_uuid_copy,
            queue: job_queue_copy,
            worker: worker,
            attempts: initial_attempts + 1,
            error_message: error_message,
            moved_to_dlq: moved_to_dlq,
        });
    }

    /// Get job details
    public fun get_job(manager: &JobQueueManager, job_uuid: String): &Job {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        table::borrow(&manager.jobs, job_uuid)
    }

    /// Get queue statistics
    public fun get_queue_stats(manager: &JobQueueManager, queue_name: String): (u64, u64) {
        if (!table::contains(&manager.queue_jobs, queue_name)) {
            return (0, 0)
        };
        
        let queue_jobs = table::borrow(&manager.queue_jobs, queue_name);
        let total_jobs = vector::length(queue_jobs);
        let mut pending_jobs = 0;
        
        let mut i = 0;
        while (i < total_jobs) {
            let job_uuid = *vector::borrow(queue_jobs, i);
            if (table::contains(&manager.jobs, job_uuid)) {
                let job = table::borrow(&manager.jobs, job_uuid);
                if (job.status == JOB_STATUS_PENDING) {
                    pending_jobs = pending_jobs + 1;
                }
            };
            i = i + 1;
        };
        
        (total_jobs, pending_jobs)
    }

    // Helper functions
    fun is_job_available(job: &Job, current_time: u64): bool {
        if (job.status != JOB_STATUS_PENDING) {
            return false
        };
        
        // Check if job is available based on available_at timestamp
        if (job.available_at > current_time) {
            return false
        };
        
        // Check visibility timeout for reserved jobs
        if (option::is_some(&job.reserved_at)) {
            let reserved_time = *option::borrow(&job.reserved_at);
            if (current_time - reserved_time < DEFAULT_VISIBILITY_TIMEOUT) {
                return false
            }
        };
        
        true
    }

    fun remove_job_from_queue(manager: &mut JobQueueManager, queue_name: &String, job_uuid: &String) {
        if (!table::contains(&manager.queue_jobs, *queue_name)) {
            return
        };
        
        let queue_jobs = table::borrow_mut(&mut manager.queue_jobs, *queue_name);
        let mut i = 0;
        while (i < vector::length(queue_jobs)) {
            if (vector::borrow(queue_jobs, i) == job_uuid) {
                vector::remove(queue_jobs, i);
                break
            };
            i = i + 1;
        }
    }

    fun refund_stake(
        manager: &mut JobQueueManager,
        recipient: address,
        amount: u64,
        reason: String,
        ctx: &mut TxContext
    ) {
        // Check if treasury has sufficient balance
        assert!(balance::value(&manager.treasury) >= amount, E_INSUFFICIENT_TREASURY);
        
        // Extract coins from treasury and transfer to recipient
        let refund_balance = balance::split(&mut manager.treasury, amount);
        let refund_coin = coin::from_balance(refund_balance, ctx);
        transfer::public_transfer(refund_coin, recipient);
    }

    /// Admin function to refund a specific job (emergency refund)
    public entry fun admin_refund_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        reason: String,
        _ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let job = table::borrow(&manager.jobs, job_uuid);
        let submitter = job.submitter;
        let stake_amount = job.priority_stake;
        let job_uuid_copy = job.uuid;
        
        // Only allow refund if job is not completed (completed jobs should keep payment)
        assert!(job.status != JOB_STATUS_COMPLETED, E_UNAUTHORIZED_REFUND);
        
        // Refund the stake
        refund_stake(manager, submitter, stake_amount, reason, _ctx);
        
        // Emit refund event
        event::emit(StakeRefunded {
            uuid: job_uuid_copy,
            submitter: submitter,
            refund_amount: stake_amount,
            reason: reason,
        });
    }

    /// User function to cancel pending job and get refund
    public entry fun cancel_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let job = table::borrow_mut(&mut manager.jobs, job_uuid);
        let submitter = tx_context::sender(ctx);
        
        // Only submitter can cancel their own job
        assert!(job.submitter == submitter, E_UNAUTHORIZED_ACCESS);
        
        // Only allow cancellation of pending jobs
        assert!(job.status == JOB_STATUS_PENDING, E_UNAUTHORIZED_REFUND);
        
        // Store values before mutations
        let job_queue_copy = job.queue;
        let job_uuid_copy = job.uuid;
        let stake_amount = job.priority_stake;
        
        // Mark job as cancelled (we can reuse DLQ status or add a new status)
        job.status = JOB_STATUS_DLQ;
        
        // Remove from queue
        remove_job_from_queue(manager, &job_queue_copy, &job_uuid_copy);
        
        // Refund the stake
        refund_stake(manager, submitter, stake_amount, string::utf8(b"Job cancelled by user"), ctx);
        
        // Emit refund event
        event::emit(StakeRefunded {
            uuid: job_uuid_copy,
            submitter: submitter,
            refund_amount: stake_amount,
            reason: string::utf8(b"Job cancelled by user"),
        });
    }

    /// Auto-refund for jobs that have been pending too long (timeout mechanism)
    public entry fun refund_expired_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let job = table::borrow_mut(&mut manager.jobs, job_uuid);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let expiry_time = 24 * 60 * 60; // 24 hours in seconds
        
        // Check if job has been pending for too long (24 hours)
        assert!(job.status == JOB_STATUS_PENDING, E_UNAUTHORIZED_REFUND);
        assert!(current_time - job.created_at > expiry_time, E_UNAUTHORIZED_REFUND);
        
        // Store values before mutations
        let job_queue_copy = job.queue;
        let job_uuid_copy = job.uuid;
        let submitter = job.submitter;
        let stake_amount = job.priority_stake;
        
        // Mark job as expired
        job.status = JOB_STATUS_DLQ;
        
        // Remove from queue
        remove_job_from_queue(manager, &job_queue_copy, &job_uuid_copy);
        
        // Refund the stake
        refund_stake(manager, submitter, stake_amount, string::utf8(b"Job expired after 24 hours"), ctx);
        
        // Emit refund event
        event::emit(StakeRefunded {
            uuid: job_uuid_copy,
            submitter: submitter,
            refund_amount: stake_amount,
            reason: string::utf8(b"Job expired after 24 hours"),
        });
    }

    /// Release reserved jobs that exceeded visibility timeout and refund if appropriate
    public entry fun release_abandoned_job(
        manager: &mut JobQueueManager,
        job_uuid: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(table::contains(&manager.jobs, job_uuid), E_JOB_NOT_FOUND);
        
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        // Store values before borrowing to avoid borrow checker issues
        let (job_queue_copy, job_uuid_copy, submitter, stake_amount, current_attempts, should_refund) = {
            let job = table::borrow_mut(&mut manager.jobs, job_uuid);
            
            // Check if job is reserved and visibility timeout exceeded
            assert!(job.status == JOB_STATUS_RESERVED, E_UNAUTHORIZED_REFUND);
            assert!(option::is_some(&job.reserved_at), E_UNAUTHORIZED_REFUND);
            
            let reserved_time = *option::borrow(&job.reserved_at);
            let timeout_exceeded = current_time - reserved_time > manager.visibility_timeout;
            assert!(timeout_exceeded, E_UNAUTHORIZED_REFUND);
            
            // Store values before mutations
            let job_queue_copy = job.queue;
            let job_uuid_copy = job.uuid;
            let submitter = job.submitter;
            let stake_amount = job.priority_stake;
            let current_attempts = job.attempts;
            
            // Clear reservation and make available for retry
            job.reserved_at = option::none();
            
            // Check if this would exceed max attempts (including the abandoned attempt)
            let will_exceed_max_attempts = current_attempts + 1 >= (manager.max_attempts as u16);
            
            if (will_exceed_max_attempts) {
                // Move to DLQ since job failed after max attempts (including abandoned)
                job.status = JOB_STATUS_DLQ;
                job.attempts = current_attempts + 1; // Count abandoned attempt
            } else {
                // Make available for retry
                job.status = JOB_STATUS_PENDING;
                job.available_at = current_time;
                job.attempts = current_attempts + 1; // Count abandoned attempt
            };
            
            (job_queue_copy, job_uuid_copy, submitter, stake_amount, current_attempts, will_exceed_max_attempts)
        };
        
        // Now handle refund and queue removal without borrowing job
        if (should_refund) {
            // REFUND: Job abandoned and no more attempts allowed
            refund_stake(manager, submitter, stake_amount, string::utf8(b"Job abandoned after visibility timeout and max attempts reached"), _ctx);
            
            // Emit refund event
            event::emit(StakeRefunded {
                uuid: job_uuid_copy,
                submitter: submitter,
                refund_amount: stake_amount,
                reason: string::utf8(b"Job abandoned after visibility timeout and max attempts reached"),
            });
            
            // Remove from queue
            remove_job_from_queue(manager, &job_queue_copy, &job_uuid_copy);
        };
        
        // Emit job failed event for the abandoned attempt
        event::emit(JobFailed {
            uuid: job_uuid_copy,
            queue: job_queue_copy,
            worker: @0x0, // No specific worker since it was abandoned
            attempts: current_attempts + 1,
            error_message: string::utf8(b"Job abandoned - visibility timeout exceeded"),
            moved_to_dlq: should_refund,
        });
    }

    // Admin functions
    public entry fun update_visibility_timeout(
        manager: &mut JobQueueManager,
        new_timeout: u64,
        _ctx: &mut TxContext
    ) {
        // Only allow admin to update (in a real implementation, you'd check admin rights)
        manager.visibility_timeout = new_timeout;
    }

    public entry fun update_max_attempts(
        manager: &mut JobQueueManager,
        new_max_attempts: u64,
        _ctx: &mut TxContext
    ) {
        // Only allow admin to update (in a real implementation, you'd check admin rights)
        manager.max_attempts = new_max_attempts;
    }
}


