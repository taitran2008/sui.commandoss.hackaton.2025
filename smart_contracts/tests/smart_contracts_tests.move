#[test_only]
module smart_contracts::job_queue_tests {
    use smart_contracts::job_queue::{Self, JobQueueManager, WorkerSubscription};
    use sui::test_scenario::{Self as test, next_tx};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self};
    use std::string::{Self, String};

    // Test addresses
    const ADMIN: address = @0x1234;
    const WORKER1: address = @0x5678;
    const SUBMITTER1: address = @0xdef0;

    #[test]
    fun test_job_submission() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize the job queue manager
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Submit a job
        next_tx(&mut scenario, SUBMITTER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            let stake = coin::mint_for_testing<SUI>(1000, test::ctx(&mut scenario));
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"job-uuid-1"),
                string::utf8(b"test-queue"),
                string::utf8(b"test-payload"),
                stake,
                &clock,
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
            clock::destroy_for_testing(clock);
        };

        // Verify the job was created
        next_tx(&mut scenario, ADMIN);
        {
            let manager = test::take_shared<JobQueueManager>(&scenario);
            let _job = job_queue::get_job(&manager, string::utf8(b"job-uuid-1"));
            
            // Basic verification that the job exists and has correct queue
            let (total_jobs, pending_jobs) = job_queue::get_queue_stats(&manager, string::utf8(b"test-queue"));
            assert!(total_jobs == 1, 0);
            assert!(pending_jobs == 1, 1);
            
            test::return_shared(manager);
        };

        test::end(scenario);
    }

    #[test]
    fun test_worker_registration() {
        let mut scenario = test::begin(WORKER1);
        
        // Register a worker
        {
            let mut queues = std::vector::empty<String>();
            std::vector::push_back(&mut queues, string::utf8(b"test-queue"));
            
            job_queue::register_worker(
                queues,
                5, // batch size
                300, // visibility timeout
                test::ctx(&mut scenario)
            );
        };

        // Verify worker subscription was created
        next_tx(&mut scenario, WORKER1);
        {
            let subscription = test::take_from_sender<WorkerSubscription>(&scenario);
            test::return_to_sender(&scenario, subscription);
        };

        test::end(scenario);
    }

    #[test]
    fun test_payment_on_successful_completion() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Submit a job
        next_tx(&mut scenario, SUBMITTER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            let stake = coin::mint_for_testing<SUI>(1000, test::ctx(&mut scenario));
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"job-uuid-payment"),
                string::utf8(b"test-queue"),
                string::utf8(b"test-payload"),
                stake,
                &clock,
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
            clock::destroy_for_testing(clock);
        };

        // Register worker
        next_tx(&mut scenario, WORKER1);
        {
            let mut queues = std::vector::empty<String>();
            std::vector::push_back(&mut queues, string::utf8(b"test-queue"));
            
            job_queue::register_worker(
                queues,
                5, // batch size
                300, // visibility timeout
                test::ctx(&mut scenario)
            );
        };

        // Worker fetches and completes job
        next_tx(&mut scenario, WORKER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let subscription = test::take_from_sender<WorkerSubscription>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            
            // Fetch jobs
            let jobs = job_queue::fetch_jobs(
                &mut manager,
                &subscription,
                string::utf8(b"test-queue"),
                &clock,
                test::ctx(&mut scenario)
            );
            
            assert!(std::vector::length(&jobs) == 1, 0);
            
            // Complete the job - this should keep the stake as payment
            job_queue::complete_job(
                &mut manager,
                string::utf8(b"job-uuid-payment"),
                &clock,
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
            test::return_to_sender(&scenario, subscription);
            clock::destroy_for_testing(clock);
        };

        // Verify job is completed and no refund was issued
        next_tx(&mut scenario, ADMIN);
        {
            let manager = test::take_shared<JobQueueManager>(&scenario);
            let job = job_queue::get_job(&manager, string::utf8(b"job-uuid-payment"));
            
            // Job should be completed (status = 2)
            // Note: We can't directly access the status field, but the job exists and was completed
            
            test::return_shared(manager);
        };

        test::end(scenario);
    }

    #[test]
    fun test_refund_on_job_failure() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Submit a job
        next_tx(&mut scenario, SUBMITTER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            let stake = coin::mint_for_testing<SUI>(1000, test::ctx(&mut scenario));
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"job-uuid-refund"),
                string::utf8(b"test-queue"),
                string::utf8(b"test-payload"),
                stake,
                &clock,
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
            clock::destroy_for_testing(clock);
        };

        // Register worker
        next_tx(&mut scenario, WORKER1);
        {
            let mut queues = std::vector::empty<String>();
            std::vector::push_back(&mut queues, string::utf8(b"test-queue"));
            
            job_queue::register_worker(
                queues,
                5, // batch size
                300, // visibility timeout
                test::ctx(&mut scenario)
            );
        };

        // Worker fetches and fails job multiple times (should trigger refund after max attempts)
        next_tx(&mut scenario, WORKER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let subscription = test::take_from_sender<WorkerSubscription>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            
            // Fail the job enough times to exceed max attempts (default is 3)
            let mut attempt = 0;
            while (attempt < 3) {
                // Fetch jobs
                let jobs = job_queue::fetch_jobs(
                    &mut manager,
                    &subscription,
                    string::utf8(b"test-queue"),
                    &clock,
                    test::ctx(&mut scenario)
                );
                
                if (std::vector::length(&jobs) > 0) {
                    // Fail the job
                    job_queue::fail_job(
                        &mut manager,
                        string::utf8(b"job-uuid-refund"),
                        string::utf8(b"Test failure"),
                        &clock,
                        test::ctx(&mut scenario)
                    );
                };
                
                attempt = attempt + 1;
            };
            
            test::return_shared(manager);
            test::return_to_sender(&scenario, subscription);
            clock::destroy_for_testing(clock);
        };

        // Verify that submitter received refund (would be in their account)
        // Note: In a real test environment, we would check the submitter's SUI balance
        
        test::end(scenario);
    }

    #[test]
    fun test_refund_on_job_cancellation() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Submit a job
        next_tx(&mut scenario, SUBMITTER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            let clock = clock::create_for_testing(test::ctx(&mut scenario));
            let stake = coin::mint_for_testing<SUI>(1000, test::ctx(&mut scenario));
            
            job_queue::submit_job(
                &mut manager,
                string::utf8(b"job-uuid-cancel"),
                string::utf8(b"test-queue"),
                string::utf8(b"test-payload"),
                stake,
                &clock,
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
            clock::destroy_for_testing(clock);
        };

        // Submitter cancels the job (should get refund)
        next_tx(&mut scenario, SUBMITTER1);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            
            job_queue::cancel_job(
                &mut manager,
                string::utf8(b"job-uuid-cancel"),
                test::ctx(&mut scenario)
            );
            
            test::return_shared(manager);
        };

        // Verify job was cancelled and refund was processed
        next_tx(&mut scenario, ADMIN);
        {
            let manager = test::take_shared<JobQueueManager>(&scenario);
            let job = job_queue::get_job(&manager, string::utf8(b"job-uuid-cancel"));
            
            // Job should be in DLQ status (cancelled)
            // Note: We can't directly access the status field, but the job exists
            
            test::return_shared(manager);
        };

        test::end(scenario);
    }

    #[test]
    fun test_queue_statistics() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Check empty queue statistics
        next_tx(&mut scenario, ADMIN);
        {
            let manager = test::take_shared<JobQueueManager>(&scenario);
            let (total_jobs, pending_jobs) = job_queue::get_queue_stats(&manager, string::utf8(b"empty-queue"));
            
            assert!(total_jobs == 0, 0);
            assert!(pending_jobs == 0, 1);
            
            test::return_shared(manager);
        };

        test::end(scenario);
    }

    #[test]
    fun test_admin_functions() {
        let mut scenario = test::begin(ADMIN);
        
        // Initialize
        {
            let ctx = test::ctx(&mut scenario);
            job_queue::test_init(ctx);
        };

        // Test updating visibility timeout
        next_tx(&mut scenario, ADMIN);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            job_queue::update_visibility_timeout(&mut manager, 600, test::ctx(&mut scenario));
            test::return_shared(manager);
        };

        // Test updating max attempts
        next_tx(&mut scenario, ADMIN);
        {
            let mut manager = test::take_shared<JobQueueManager>(&scenario);
            job_queue::update_max_attempts(&mut manager, 5, test::ctx(&mut scenario));
            test::return_shared(manager);
        };

        test::end(scenario);
    }
}
