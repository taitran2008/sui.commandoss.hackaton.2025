#[test_only]
module smart_contracts::job_queue_tests {
    use smart_contracts::job_queue::{Self, JobQueueManager, WorkerSubscription};
    use sui::test_scenario::{Self as test, Scenario, next_tx, ctx};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

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
            let job = job_queue::get_job(&manager, string::utf8(b"job-uuid-1"));
            
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
            let queues = vector::empty<String>();
            vector::push_back(&mut queues, string::utf8(b"test-queue"));
            
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
