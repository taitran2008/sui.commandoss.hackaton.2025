/// A decentralized job queue where users can submit jobs, and workers can claim and complete them.
/// Once completed, the worker gets rewarded in SUI or another token.
module smart_contracts::job_queue {
    use std::string::{Self, String};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;

    // Error codes
    const E_JOB_ALREADY_CLAIMED: u64 = 2;
    const E_NOT_JOB_CLAIMER: u64 = 3;
    const E_JOB_NOT_COMPLETED: u64 = 4;
    const E_NOT_JOB_SUBMITTER: u64 = 5;
    const E_EMPTY_DESCRIPTION: u64 = 7;
    const E_JOB_EXPIRED: u64 = 8;
    const E_INVALID_TIMEOUT: u64 = 9;

    // Job status - Enhanced with REJECTED status
    const JOB_STATUS_PENDING: u8 = 0;
    const JOB_STATUS_CLAIMED: u8 = 1;
    const JOB_STATUS_COMPLETED: u8 = 2;
    const JOB_STATUS_VERIFIED: u8 = 3;

    /// Job object that stores job details and reward
    public struct Job has key, store {
        id: UID,
        description: String,
        reward: Balance<SUI>,
        submitter: address,
        worker: Option<address>,
        result: Option<String>,
        status: u8,
        created_at: u64,
        claimed_at: Option<u64>,
        completed_at: Option<u64>,
        timeout_minutes: u64,  // Configurable timeout per job in minutes
        deadline_ms: Option<u64>, // Absolute deadline (now + timeout_minutes) when job is claimed
    }

    /// Job Queue Manager - shared object that manages all jobs
    public struct JobQueueManager has key {
        id: UID,
        total_jobs: u64,
        pending_jobs: vector<ID>,
    }

    // Events
    public struct JobSubmitted has copy, drop {
        job_id: ID,
        description: String,
        reward_amount: u64,
        submitter: address,
        timestamp: u64,
    }

    public struct JobClaimed has copy, drop {
        job_id: ID,
        worker: address,
        timestamp: u64,
    }

    public struct JobCompleted has copy, drop {
        job_id: ID,
        worker: address,
        result: String,
        timestamp: u64,
    }

    public struct JobVerified has copy, drop {
        job_id: ID,
        worker: address,
        reward_amount: u64,
        timestamp: u64,
    }

    public struct JobRejected has copy, drop {
        job_id: ID,
        worker: address,
        reason: String,
        timestamp: u64,
    }

    public struct JobReleased has copy, drop {
        job_id: ID,
        worker: address,
        reason: String,
        timestamp: u64,
    }

    /// Initialize the job queue system
    fun init(ctx: &mut TxContext) {
        let manager = JobQueueManager {
            id: object::new(ctx),
            total_jobs: 0,
            pending_jobs: vector::empty(),
        };
        transfer::share_object(manager);
    }

    /// Test initialization function for testing
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }

    /// Submit a new job with a reward and configurable timeout
    /// Example: "Translate 100 words into French" with 1 SUI reward and 720 minute (12 hour) timeout
    public entry fun submit_job(
        manager: &mut JobQueueManager,
        description: String,
        reward: Coin<SUI>,
        timeout_minutes: u64,  // Timeout in minutes (30-2880 = 30min to 48h)
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(!string::is_empty(&description), E_EMPTY_DESCRIPTION);
        assert!(timeout_minutes >= 30 && timeout_minutes <= 2880, E_INVALID_TIMEOUT); // 30min to 48h
        
        let reward_amount = coin::value(&reward);
        let current_time = clock::timestamp_ms(clock);
        let submitter = tx_context::sender(ctx);

        let job = Job {
            id: object::new(ctx),
            description,
            reward: coin::into_balance(reward),
            submitter,
            worker: option::none(),
            result: option::none(),
            status: JOB_STATUS_PENDING,
            created_at: current_time,
            claimed_at: option::none(),
            completed_at: option::none(),
            timeout_minutes,
            deadline_ms: option::none(), // Will be set when job is claimed
        };

        let job_id = object::id(&job);
        
        // Add job to pending queue
        vector::push_back(&mut manager.pending_jobs, job_id);
        manager.total_jobs = manager.total_jobs + 1;

        // Emit event
        event::emit(JobSubmitted {
            job_id,
            description: job.description,
            reward_amount,
            submitter,
            timestamp: current_time,
        });

        // Transfer job object to shared storage
        transfer::share_object(job);
    }

    /// Worker claims a job from the queue
    public entry fun claim_job(
        manager: &mut JobQueueManager,
        job: &mut Job,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(job.status == JOB_STATUS_PENDING, E_JOB_ALREADY_CLAIMED);
        
        let worker = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        let job_id = object::id(job);

        // Calculate deadline: now + timeout_minutes (converted to milliseconds)
        let deadline = current_time + (job.timeout_minutes * 60_000); // Convert minutes to ms

        // Update job status
        job.status = JOB_STATUS_CLAIMED;
        job.worker = option::some(worker);
        job.claimed_at = option::some(current_time);
        job.deadline_ms = option::some(deadline);

        // Remove from pending queue
        let (found, index) = vector::index_of(&manager.pending_jobs, &job_id);
        if (found) {
            vector::remove(&mut manager.pending_jobs, index);
        };

        // Emit event
        event::emit(JobClaimed {
            job_id,
            worker,
            timestamp: current_time,
        });
    }

    /// Worker submits the completed job with result
    public entry fun complete_job(
        job: &mut Job,
        result: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(job.status == JOB_STATUS_CLAIMED, E_JOB_NOT_COMPLETED);
        
        let worker = tx_context::sender(ctx);
        assert!(option::contains(&job.worker, &worker), E_NOT_JOB_CLAIMER);
        
        let current_time = clock::timestamp_ms(clock);
        let job_id = object::id(job);

        // Update job with result
        job.status = JOB_STATUS_COMPLETED;
        job.result = option::some(result);
        job.completed_at = option::some(current_time);

        // Emit event
        event::emit(JobCompleted {
            job_id,
            worker,
            result: *option::borrow(&job.result),
            timestamp: current_time,
        });
    }

    /// Job submitter verifies the work and releases payment to worker
    public entry fun verify_and_release(
        job: &mut Job,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(job.status == JOB_STATUS_COMPLETED, E_JOB_NOT_COMPLETED);
        
        let submitter = tx_context::sender(ctx);
        assert!(job.submitter == submitter, E_NOT_JOB_SUBMITTER);
        
        let worker = *option::borrow(&job.worker);
        let reward_amount = balance::value(&job.reward);
        let current_time = clock::timestamp_ms(clock);
        let job_id = object::id(job);

        // Transfer reward to worker
        let reward_balance = balance::withdraw_all(&mut job.reward);
        let reward_coin = coin::from_balance(reward_balance, ctx);
        transfer::public_transfer(reward_coin, worker);

        // Update job status
        job.status = JOB_STATUS_VERIFIED;

        // Emit event
        event::emit(JobVerified {
            job_id,
            worker,
            reward_amount,
            timestamp: current_time,
        });
    }

    /// Delete a completed and verified job to reclaim storage and get rebate
    public entry fun delete_job(job: Job, _ctx: &mut TxContext) {
        assert!(job.status == JOB_STATUS_VERIFIED, E_JOB_NOT_COMPLETED);
        
        let Job {
            id,
            description: _,
            reward,
            submitter: _,
            worker: _,
            result: _,
            status: _,
            created_at: _,
            claimed_at: _,
            completed_at: _,
            timeout_minutes: _,
            deadline_ms: _,
        } = job;

        // Ensure reward is empty before deletion
        balance::destroy_zero(reward);
        object::delete(id);
        
        // Storage rebate is automatically issued when object is deleted
    }

    /// Job submitter rejects the work and resets job to pending status
    public entry fun reject_job(
        manager: &mut JobQueueManager,
        job: &mut Job,
        reason: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(job.status == JOB_STATUS_COMPLETED, E_JOB_NOT_COMPLETED);
        
        let submitter = tx_context::sender(ctx);
        assert!(job.submitter == submitter, E_NOT_JOB_SUBMITTER);
        
        let current_time = clock::timestamp_ms(clock);
        let job_id = object::id(job);
        let worker = *option::borrow(&job.worker);

        // Reset job to pending status for re-claiming
        job.status = JOB_STATUS_PENDING;
        job.worker = option::none();
        job.result = option::none();
        job.claimed_at = option::none();
        job.completed_at = option::none();
        job.deadline_ms = option::none();

        // Add back to pending queue
        vector::push_back(&mut manager.pending_jobs, job_id);

        // Emit event
        event::emit(JobRejected {
            job_id,
            worker,
            reason,
            timestamp: current_time,
        });
    }

    /// Release a job back to the queue if worker exceeded timeout
    /// Can be called by anyone to clean up expired jobs
    public entry fun release_expired_job(
        manager: &mut JobQueueManager,
        job: &mut Job,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(job.status == JOB_STATUS_CLAIMED, E_JOB_NOT_COMPLETED);
        
        // Use the helper function to check if job has expired
        assert!(is_job_expired(job, clock), E_JOB_EXPIRED);
        
        let job_id = object::id(job);
        let worker = *option::borrow(&job.worker);
        let current_time = clock::timestamp_ms(clock);

        // Reset job to pending status for re-claiming
        job.status = JOB_STATUS_PENDING;
        job.worker = option::none();
        job.claimed_at = option::none();
        job.deadline_ms = option::none();

        // Add back to pending queue
        vector::push_back(&mut manager.pending_jobs, job_id);

        // Emit event
        event::emit(JobReleased {
            job_id,
            worker,
            reason: string::utf8(b"Job timeout exceeded"),
            timestamp: current_time,
        });
    }

    // === View Functions ===

    /// Get job details
    public fun get_job_details(job: &Job): (String, u64, address, Option<address>, Option<String>, u8) {
        (
            job.description,
            balance::value(&job.reward),
            job.submitter,
            job.worker,
            job.result,
            job.status
        )
    }

    /// Get job timestamps
    public fun get_job_timestamps(job: &Job): (u64, Option<u64>, Option<u64>) {
        (job.created_at, job.claimed_at, job.completed_at)
    }

    /// Get number of pending jobs
    public fun get_pending_jobs_count(manager: &JobQueueManager): u64 {
        vector::length(&manager.pending_jobs)
    }

    /// Get total jobs count
    public fun get_total_jobs_count(manager: &JobQueueManager): u64 {
        manager.total_jobs
    }

    /// Get list of pending job IDs
    public fun get_pending_job_ids(manager: &JobQueueManager): vector<ID> {
        manager.pending_jobs
    }

    /// Check if job is available for claiming
    public fun is_job_available(job: &Job): bool {
        job.status == JOB_STATUS_PENDING
    }

    /// Check if job is completed and ready for verification
    public fun is_job_ready_for_verification(job: &Job): bool {
        job.status == JOB_STATUS_COMPLETED
    }

    /// Get job timeout in milliseconds
    public fun get_job_timeout_ms(job: &Job): u64 {
        job.timeout_minutes * 60_000 // Convert minutes to milliseconds
    }

    /// Check if a claimed job has expired based on timeout
    public fun is_job_expired(job: &Job, clock: &Clock): bool {
        if (job.status != JOB_STATUS_CLAIMED) {
            return false
        };
        
        if (option::is_none(&job.deadline_ms)) {
            return false
        };
        
        let current_time = clock::timestamp_ms(clock);
        let deadline = *option::borrow(&job.deadline_ms);
        
        current_time > deadline
    }

    /// Get job status as a readable string (for debugging/display purposes)
    public fun get_job_status_string(job: &Job): String {
        if (job.status == JOB_STATUS_PENDING) {
            string::utf8(b"PENDING")
        } else if (job.status == JOB_STATUS_CLAIMED) {
            string::utf8(b"CLAIMED")
        } else if (job.status == JOB_STATUS_COMPLETED) {
            string::utf8(b"COMPLETED")
        } else if (job.status == JOB_STATUS_VERIFIED) {
            string::utf8(b"VERIFIED")
        } else {
            string::utf8(b"UNKNOWN")
        }
    }

    /// Get job deadline in milliseconds (when it was claimed + timeout)
    public fun get_job_deadline_ms(job: &Job): Option<u64> {
        job.deadline_ms
    }

    /// Get job timeout in minutes
    public fun get_job_timeout_minutes(job: &Job): u64 {
        job.timeout_minutes
    }

    /// Get remaining time in minutes for a claimed job
    public fun get_remaining_time_minutes(job: &Job, clock: &Clock): u64 {
        if (job.status != JOB_STATUS_CLAIMED || option::is_none(&job.deadline_ms)) {
            return 0
        };
        
        let current_time = clock::timestamp_ms(clock);
        let deadline = *option::borrow(&job.deadline_ms);
        
        if (current_time >= deadline) {
            0
        } else {
            (deadline - current_time) / 60_000 // Convert ms to minutes
        }
    }
}