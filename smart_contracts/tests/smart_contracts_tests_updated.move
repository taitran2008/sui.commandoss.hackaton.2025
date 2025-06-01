/// Tests for the decentralized job queue smart contract
/// Covers all key features: submit job, claim job, complete job, verify & release payment, delete job
/// Also tests new features: timeout management, job expiration, rejection workflows
#[test_only]
module smart_contracts::job_queue_tests {
    use std::string::{Self};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::test_scenario::{Self as ts, Scenario};
    use smart_contracts::job_queue::{
        Self, 
        JobQueueManager, 
        Job,
        test_init,
        get_job_details,
        get_job_timestamps,
        get_pending_jobs_count,
        get_total_jobs_count,
        is_job_available,
        is_job_ready_for_verification,
        is_job_expired,
        get_job_timeout_minutes,
        get_job_deadline_ms,
        get_remaining_time_minutes,
        get_job_status_string
    };

    // Test addresses
    const ALICE: address = @0xa11ce;  // Job submitter
    const BOB: address = @0xb0b;      // Worker
    const CHARLIE: address = @0xc4a4; // Another worker

    // Test constants
    const REWARD_AMOUNT: u64 = 1_000_000_000; // 1 SUI
    const SMALL_REWARD: u64 = 100_000_000;    // 0.1 SUI
    const DEFAULT_TIMEOUT: u64 = 720;         // 12 hours in minutes
    const SHORT_TIMEOUT: u64 = 30;            // 30 minutes (minimum)
    const LONG_TIMEOUT: u64 = 2880;           // 48 hours (maximum)
    
    // === Helper Functions ===

    fun create_test_coin(amount: u64, scenario: &mut Scenario): Coin<SUI> {
        coin::mint_for_testing<SUI>(amount, ts::ctx(scenario))
    }

    fun create_test_clock(timestamp_ms: u64, scenario: &mut Scenario): Clock {
        let mut clock = clock::create_for_testing(ts::ctx(scenario));
        clock::set_for_testing(&mut clock, timestamp_ms);
        clock
    }

    // === Test Cases ===

    #[test]
    /// Test the complete workflow: Alice submits job → Bob claims → Bob completes → Alice verifies → Delete job
    /// This tests the main use case from the copilot instruction
    fun test_complete_job_workflow() {
        let mut scenario = ts::begin(ALICE);
        
        // Step 1: Initialize the job queue system
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        // Step 2: Alice submits a job: "Translate 100 words into French" with 1 SUI reward
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Translate 100 words into French"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            // Verify manager state
            assert!(get_pending_jobs_count(&manager) == 1, 0);
            assert!(get_total_jobs_count(&manager) == 1, 1);
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Step 3: Bob sees the job and claims it
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            // Verify job is available for claiming
            assert!(is_job_available(&job), 2);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            // Verify job state after claiming
            let (description, reward_amount, submitter, worker, result, status) = get_job_details(&job);
            assert!(description == string::utf8(b"Translate 100 words into French"), 3);
            assert!(reward_amount == REWARD_AMOUNT, 4);
            assert!(submitter == ALICE, 5);
            assert!(option::is_some(&worker) && *option::borrow(&worker) == BOB, 6);
            assert!(option::is_none(&result), 7);
            assert!(status == 1, 8); // JOB_STATUS_CLAIMED
            assert!(!is_job_available(&job), 9);
            
            // Verify timeout and deadline are set correctly
            assert!(get_job_timeout_minutes(&job) == DEFAULT_TIMEOUT, 10);
            assert!(option::is_some(&get_job_deadline_ms(&job)), 11);
            
            // Verify manager state - job should be removed from pending queue
            assert!(get_pending_jobs_count(&manager) == 0, 12);
            assert!(get_total_jobs_count(&manager) == 1, 13);
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Step 4: Bob does the translation and calls complete_job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Traduire 100 mots en français"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            // Verify job state after completion
            let (_, _, _, _, result, status) = get_job_details(&job);
            assert!(option::is_some(&result), 14);
            assert!(*option::borrow(&result) == string::utf8(b"Traduire 100 mots en français"), 15);
            assert!(status == 2, 16); // JOB_STATUS_COMPLETED
            assert!(is_job_ready_for_verification(&job), 17);
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Step 5: Alice checks the result and calls verify_and_release, transferring 1 SUI to Bob
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(4000, &mut scenario);
            
            job_queue::verify_and_release(&mut job, &clock, ts::ctx(&mut scenario));
            
            // Verify job state after verification
            let (_, reward_amount, _, _, _, status) = get_job_details(&job);
            assert!(reward_amount == 0, 18); // Reward should be transferred out
            assert!(status == 3, 19); // JOB_STATUS_VERIFIED
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Step 6: The job object is deleted → storage rebate issued
        ts::next_tx(&mut scenario, ALICE);
        {
            let job = ts::take_shared_by_id<Job>(&scenario, job_id);
            
            job_queue::delete_job(job, ts::ctx(&mut scenario));
            // Job is now deleted, storage rebate automatically issued
        };
        
        // Verify Bob received the reward
        ts::next_tx(&mut scenario, BOB);
        {
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&coin) == REWARD_AMOUNT, 20);
            ts::return_to_sender(&scenario, coin);
        };
        
        ts::end(scenario);
    }

    #[test]
    /// Test submitting multiple jobs and tracking them correctly
    fun test_submit_multiple_jobs() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        // Submit first job
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Write a blog post"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            assert!(get_pending_jobs_count(&manager) == 1, 0);
            assert!(get_total_jobs_count(&manager) == 1, 1);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
        };
        
        // Submit second job
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(SMALL_REWARD, &mut scenario);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Create a logo design"),
                reward_coin,
                SHORT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            assert!(get_pending_jobs_count(&manager) == 2, 2);
            assert!(get_total_jobs_count(&manager) == 2, 3);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_NOT_JOB_CLAIMER)]
    /// Test that only the worker who claimed the job can complete it
    fun test_only_claimer_can_complete_job() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Bob claims the job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Charlie tries to complete the job (should fail)
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            // This should abort with E_NOT_JOB_CLAIMER
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Fake result"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_NOT_JOB_SUBMITTER)]
    /// Test that only the job submitter can verify and release payment
    fun test_only_submitter_can_verify() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize, submit, claim, and complete job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Bob claims and completes the job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::next_tx(&mut scenario, BOB);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Completed work"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Charlie tries to verify (should fail)
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(4000, &mut scenario);
            
            // This should abort with E_NOT_JOB_SUBMITTER
            job_queue::verify_and_release(
                &mut job,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_JOB_ALREADY_CLAIMED)]
    /// Test that a job cannot be claimed twice
    fun test_job_cannot_be_claimed_twice() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Bob claims the job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Charlie tries to claim the same job (should fail)
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            // This should abort with E_JOB_ALREADY_CLAIMED
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_EMPTY_DESCRIPTION)]
    /// Test that empty job description is rejected
    fun test_empty_description_rejected() {
        let mut scenario = ts::begin(ALICE);
        
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            // This should abort with E_EMPTY_DESCRIPTION
            job_queue::submit_job(
                &mut manager,
                string::utf8(b""), // Empty description
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_INVALID_TIMEOUT)]
    /// Test that invalid timeout values are rejected
    fun test_invalid_timeout_rejected() {
        let mut scenario = ts::begin(ALICE);
        
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            // This should abort with E_INVALID_TIMEOUT (timeout too short)
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                15, // Less than 30 minutes minimum
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    /// Test job timestamps are correctly set
    fun test_job_timestamps() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Check initial timestamps
        ts::next_tx(&mut scenario, ALICE);
        {
            let job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let (created_at, claimed_at, completed_at) = get_job_timestamps(&job);
            
            assert!(created_at == 1000, 0);
            assert!(option::is_none(&claimed_at), 1);
            assert!(option::is_none(&completed_at), 2);
            
            ts::return_shared(job);
        };
        
        // Claim job and check timestamps
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            let (created_at, claimed_at, completed_at) = get_job_timestamps(&job);
            assert!(created_at == 1000, 3);
            assert!(option::is_some(&claimed_at) && *option::borrow(&claimed_at) == 2000, 4);
            assert!(option::is_none(&completed_at), 5);
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Complete job and check timestamps
        ts::next_tx(&mut scenario, BOB);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Result"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let (created_at, claimed_at, completed_at) = get_job_timestamps(&job);
            assert!(created_at == 1000, 6);
            assert!(option::is_some(&claimed_at) && *option::borrow(&claimed_at) == 2000, 7);
            assert!(option::is_some(&completed_at) && *option::borrow(&completed_at) == 3000, 8);
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    /// Test job expiration and release workflow
    fun test_job_expiration_and_release() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job with short timeout
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job with timeout"),
                reward_coin,
                SHORT_TIMEOUT, // 30 minutes
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Bob claims the job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            // Verify job is not expired yet
            assert!(!is_job_expired(&job, &clock), 0);
            
            // Check remaining time
            let remaining = get_remaining_time_minutes(&job, &clock);
            assert!(remaining == SHORT_TIMEOUT, 1); // Should have full timeout remaining
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Time passes beyond the timeout (30 minutes = 30 * 60 * 1000 = 1,800,000 ms)
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let expired_time = 2000 + (SHORT_TIMEOUT * 60_000) + 1000; // Past deadline
            let clock = create_test_clock(expired_time, &mut scenario);
            
            // Verify job is expired
            assert!(is_job_expired(&job, &clock), 2);
            
            // Charlie releases the expired job
            job_queue::release_expired_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            // Verify job is back to pending status
            assert!(is_job_available(&job), 3);
            assert!(get_pending_jobs_count(&manager) == 1, 4);
            
            // Verify job state is reset
            let (_, _, _, worker, _, status) = get_job_details(&job);
            assert!(option::is_none(&worker), 5);
            assert!(status == 0, 6); // JOB_STATUS_PENDING
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    /// Test job rejection workflow
    fun test_job_rejection_workflow() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize, submit, claim, and complete job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Create a website"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Bob claims and completes the job
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::next_tx(&mut scenario, BOB);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Low quality website"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Alice rejects the work
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(4000, &mut scenario);
            
            job_queue::reject_job(
                &mut manager,
                &mut job,
                string::utf8(b"Quality does not meet requirements"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            // Verify job is back to pending status
            assert!(is_job_available(&job), 0);
            assert!(get_pending_jobs_count(&manager) == 1, 1);
            
            // Verify job state is reset
            let (_, _, _, worker, result, status) = get_job_details(&job);
            assert!(option::is_none(&worker), 2);
            assert!(option::is_none(&result), 3);
            assert!(status == 0, 4); // JOB_STATUS_PENDING
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    /// Test job status string helper function
    fun test_job_status_strings() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Test PENDING status
        ts::next_tx(&mut scenario, ALICE);
        {
            let job = ts::take_shared_by_id<Job>(&scenario, job_id);
            assert!(get_job_status_string(&job) == string::utf8(b"PENDING"), 0);
            ts::return_shared(job);
        };
        
        // Claim job and test CLAIMED status
        ts::next_tx(&mut scenario, BOB);
        {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(2000, &mut scenario);
            
            job_queue::claim_job(&mut manager, &mut job, &clock, ts::ctx(&mut scenario));
            assert!(get_job_status_string(&job) == string::utf8(b"CLAIMED"), 1);
            
            ts::return_shared(manager);
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Complete job and test COMPLETED status
        ts::next_tx(&mut scenario, BOB);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(3000, &mut scenario);
            
            job_queue::complete_job(
                &mut job,
                string::utf8(b"Result"),
                &clock,
                ts::ctx(&mut scenario)
            );
            
            assert!(get_job_status_string(&job) == string::utf8(b"COMPLETED"), 2);
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        // Verify job and test VERIFIED status
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut job = ts::take_shared_by_id<Job>(&scenario, job_id);
            let clock = create_test_clock(4000, &mut scenario);
            
            job_queue::verify_and_release(&mut job, &clock, ts::ctx(&mut scenario));
            assert!(get_job_status_string(&job) == string::utf8(b"VERIFIED"), 3);
            
            ts::return_shared(job);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = smart_contracts::job_queue::E_JOB_NOT_COMPLETED)]
    /// Test that only verified jobs can be deleted
    fun test_only_verified_jobs_can_be_deleted() {
        let mut scenario = ts::begin(ALICE);
        
        // Initialize and submit job
        {
            test_init(ts::ctx(&mut scenario));
        };
        
        ts::next_tx(&mut scenario, ALICE);
        let job_id = {
            let mut manager = ts::take_shared<JobQueueManager>(&scenario);
            let reward_coin = create_test_coin(REWARD_AMOUNT, &mut scenario);
            let clock = create_test_clock(1000, &mut scenario);
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"Test job"),
                reward_coin,
                DEFAULT_TIMEOUT,
                &clock,
                ts::ctx(&mut scenario)
            );
            
            let pending_jobs = job_queue::get_pending_job_ids(&manager);
            let job_id = *vector::borrow(&pending_jobs, 0);
            
            ts::return_shared(manager);
            clock::destroy_for_testing(clock);
            job_id
        };
        
        // Try to delete pending job (should fail)
        ts::next_tx(&mut scenario, ALICE);
        {
            let job = ts::take_shared_by_id<Job>(&scenario, job_id);
            
            // This should abort with E_JOB_NOT_COMPLETED
            job_queue::delete_job(job, ts::ctx(&mut scenario));
        };
        
        ts::end(scenario);
    }
}
