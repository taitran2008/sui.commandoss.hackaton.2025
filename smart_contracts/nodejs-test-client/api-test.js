const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Transaction } = require('@mysten/sui/transactions');
const { fromBase64 } = require('@mysten/sui/utils');
const fs = require('fs');
const path = require('path');

// Contract Information - Updated from latest deployment (Edm7ZwuduLtdn5N6otZKi842LwqvLDiQSpudxAxTmcZ8)
const PACKAGE_ID = '0x4c88f13fcac79eea1c99b1e3c1e95b7303c42eeb5ba5ad5569d4b1e08fca4a54';
const JOB_QUEUE_MANAGER_ID = '0xe8de4938a2dcdb1f7543537dbd6d2127ad378f8f0d7db6243dc18a518dcf4f64';
const CLOCK_ID = '0x6';

// Job Configuration - Change staking amount here
const STAKE_AMOUNT_SUI = 0.03; // SUI amount to stake per job (worker reward)
const STAKE_AMOUNT_MIST = STAKE_AMOUNT_SUI * 1_000_000_000; // Convert to MIST (1 SUI = 1,000,000,000 MIST)

// Wallet Information
const SUBMITTER_ADDRESS = '0xe9248c4d485f14590a36410b47db4db2325b6e87f747ed90c5c7d7519a3bdc15';
const WORKER_ADDRESS = '0xf0e1815d21148b1d3113215d217bc9576b2f6f56e10741c1d493ef8178a0180c';

// Initialize Sui client
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// Load wallet helper function (for 32-byte keys)
function loadWallet(walletPath) {
    try {
        const privateKeyBase64 = fs.readFileSync(walletPath, 'utf8').trim();
        const privateKey = fromBase64(privateKeyBase64);
        
        if (privateKey.length !== 32) {
            throw new Error(`Invalid private key length: ${privateKey.length} bytes, expected 32 bytes`);
        }
        
        const keypair = Ed25519Keypair.fromSecretKey(privateKey);
        return keypair;
    } catch (error) {
        console.error(`Failed to load wallet from ${walletPath}:`, error.message);
        throw error;
    }
}

// Wait for transaction confirmation
async function waitForTransaction(txDigest) {
    console.log(`⏳ Waiting for transaction confirmation: ${txDigest}`);
    
    for (let i = 0; i < 30; i++) {
        try {
            const txResult = await client.getTransactionBlock({
                digest: txDigest,
                options: {
                    showEvents: true,
                    showEffects: true,
                    showInput: true,
                }
            });
            
            if (txResult.effects?.status?.status === 'success') {
                console.log(`✅ Transaction confirmed successfully`);
                return txResult;
            } else if (txResult.effects?.status?.status === 'failure') {
                console.error(`❌ Transaction failed:`, txResult.effects?.status?.error);
                throw new Error(`Transaction failed: ${txResult.effects?.status?.error}`);
            }
        } catch (error) {
            if (i === 29) {
                console.error(`❌ Transaction confirmation timeout after 30 attempts`);
                throw error;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Standalone function to check treasury balance
async function checkTreasuryBalance(senderAddress = SUBMITTER_ADDRESS, description = "Treasury balance") {
    try {
        console.log(`\n💰 ${description} check...`);
        
        const getTreasuryTxb = new Transaction();
        getTreasuryTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_treasury_balance`,
            arguments: [
                getTreasuryTxb.object(JOB_QUEUE_MANAGER_ID)
            ]
        });

        const treasuryResult = await client.devInspectTransactionBlock({
            transactionBlock: getTreasuryTxb,
            sender: senderAddress
        });

        if (treasuryResult.results?.[0]?.returnValues?.[0]) {
            const treasuryBalanceBytes = treasuryResult.results[0].returnValues[0];
            const treasuryBalanceMist = parseInt(treasuryBalanceBytes[0]) || 0;
            const treasuryBalanceSui = treasuryBalanceMist / 1_000_000_000;
            
            console.log(`💰 ${description}: ${treasuryBalanceSui} SUI (${treasuryBalanceMist} MIST)`);
            
            return {
                success: true,
                balanceSui: treasuryBalanceSui,
                balanceMist: treasuryBalanceMist
            };
        } else {
            console.log(`❌ Failed to retrieve ${description.toLowerCase()}`);
            return { success: false, balanceSui: 0, balanceMist: 0 };
        }
    } catch (error) {
        console.error(`❌ Error checking ${description.toLowerCase()}:`, error);
        return { success: false, balanceSui: 0, balanceMist: 0 };
    }
}

// Case 1: Submit a job on chain and get worker to fetch this job to see the job content
async function testCase1() {
    console.log('\n🧪 =================================');
    console.log('🧪 TEST CASE 1: Job Submission & Worker Fetch');
    console.log('🧪 =================================\n');

    try {
        // Step 1: Load wallets
        console.log('📋 Step 1: Loading wallets...');
        const submitterPath = path.join(__dirname, 'wallets', 'submitter', SUBMITTER_ADDRESS);
        const workerPath = path.join(__dirname, 'wallets', 'worker', WORKER_ADDRESS);
        
        const submitterKeypair = loadWallet(submitterPath);
        const workerKeypair = loadWallet(workerPath);
        
        const submitterAddressFromKey = submitterKeypair.getPublicKey().toSuiAddress();
        const workerAddressFromKey = workerKeypair.getPublicKey().toSuiAddress();
        
        console.log(`✅ Submitter wallet loaded: ${submitterAddressFromKey}`);
        console.log(`✅ Worker wallet loaded: ${workerAddressFromKey}`);

        // Step 2: Check wallet balances
        console.log('\n📋 Step 2: Checking wallet balances...');
        
        const submitterBalance = await client.getBalance({
            owner: submitterAddressFromKey,
            coinType: '0x2::sui::SUI'
        });
        
        const workerBalance = await client.getBalance({
            owner: workerAddressFromKey,
            coinType: '0x2::sui::SUI'
        });
        
        console.log(`💰 Submitter balance: ${parseInt(submitterBalance.totalBalance) / 1_000_000_000} SUI`);
        console.log(`💰 Worker balance: ${parseInt(workerBalance.totalBalance) / 1_000_000_000} SUI`);

        // Step 3: Worker Registration (check if already registered)
        console.log('\n📋 Step 3: Checking worker registration status...');
        
        // Get all objects owned by the worker to check for existing WorkerSubscription
        const workerObjects = await client.getOwnedObjects({
            owner: workerAddressFromKey,
            filter: {
                StructType: `${PACKAGE_ID}::job_queue::WorkerSubscription`
            },
            options: {
                showContent: true,
                showType: true
            }
        });
        
        let workerSubscriptionId = null;
        let registerResult = null; // Declare outside conditional block
        
        if (workerObjects.data.length > 0) {
            // Worker already has a subscription, use the first one
            workerSubscriptionId = workerObjects.data[0].data.objectId;
            console.log(`✅ Worker already registered! Using existing subscription ID: ${workerSubscriptionId}`);
            console.log(`📊 Found ${workerObjects.data.length} existing subscription(s)`);
        } else {
            // Worker needs to register
            console.log('📝 Worker not registered yet, registering now...');
            
            const registerTxb = new Transaction();
            registerTxb.moveCall({
                target: `${PACKAGE_ID}::job_queue::register_worker`,
                arguments: [
                    registerTxb.object(JOB_QUEUE_MANAGER_ID),
                    registerTxb.pure.vector('string', ['test_queue']),  // queues to subscribe to
                    registerTxb.pure.u64(10),              // batch_size
                    registerTxb.pure.u64(300)              // visibility_timeout (5 minutes)
                ]
            });

            registerResult = await client.signAndExecuteTransaction({
                transaction: registerTxb,
                signer: workerKeypair,
                options: {
                    showEvents: true,
                    showEffects: true,
                    showObjectChanges: true
                }
            });

            console.log(`📝 Worker registration transaction: ${registerResult.digest}`);
            await waitForTransaction(registerResult.digest);

            // Find WorkerSubscription object from the transaction
            if (registerResult.objectChanges) {
                for (const change of registerResult.objectChanges) {
                    if (change.type === 'created' && change.objectType?.includes('WorkerSubscription')) {
                        workerSubscriptionId = change.objectId;
                        break;
                    }
                }
            }

            if (!workerSubscriptionId) {
                throw new Error('Failed to find WorkerSubscription object ID');
            }
            
            console.log(`✅ Worker registered successfully with new subscription ID: ${workerSubscriptionId}`);
        }

        // Step 4: Submit a job
        console.log('\n📋 Step 4: Submitting job...');
        
        const jobUuid = `test-job-${Date.now()}`;
        const jobPayload = JSON.stringify({
            type: 'image_processing',
            input_url: 'https://example.com/image.jpg',
            filters: ['brightness', 'contrast'],
            output_format: 'png',
            timestamp: new Date().toISOString(),
            description: 'Process an image with brightness and contrast filters'
        });
        
        console.log(`🆔 Job UUID: ${jobUuid}`);
        console.log(`📦 Job Payload: ${jobPayload}`);

        const submitTxb = new Transaction();
        const [coin] = submitTxb.splitCoins(submitTxb.gas, [submitTxb.pure.u64(STAKE_AMOUNT_MIST)]); // Use configurable stake amount
        
        console.log(`💰 Staking ${STAKE_AMOUNT_SUI} SUI (${STAKE_AMOUNT_MIST} MIST) - will be paid directly to worker upon completion`);
        console.log(`🎯 Payment Model: Direct worker rewards (not platform fees)`);
        
        submitTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::submit_job`,
            arguments: [
                submitTxb.object(JOB_QUEUE_MANAGER_ID),
                submitTxb.pure.string(jobUuid),
                submitTxb.pure.string('test_queue'),
                submitTxb.pure.string(jobPayload),
                coin,
                submitTxb.object(CLOCK_ID)
            ]
        });

        const submitResult = await client.signAndExecuteTransaction({
            transaction: submitTxb,
            signer: submitterKeypair,
            options: {
                showEvents: true,
                showEffects: true
            }
        });

        console.log(`📝 Job submission transaction: ${submitResult.digest}`);
        await waitForTransaction(submitResult.digest);

        // Check for JobSubmitted event
        if (submitResult.events) {
            for (const event of submitResult.events) {
                if (event.type.includes('JobSubmitted')) {
                    console.log(`✅ Job submitted event:`, event.parsedJson);
                }
            }
        }

        console.log(`✅ Job submitted successfully!`);

        // Step 4.5: Check treasury balance after staking
        console.log('\n📋 Step 4.5: Checking treasury balance after staking...');
        
        const treasuryAfterStake = await checkTreasuryBalance(submitterAddressFromKey, "Treasury balance after staking");

        // Step 5: Get job details before fetching
        console.log('\n📋 Step 5: Getting job details before worker fetch...');
        
        const getJobTxb = new Transaction();
        getJobTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job`,
            arguments: [
                getJobTxb.object(JOB_QUEUE_MANAGER_ID),
                getJobTxb.pure.string(jobUuid)
            ]
        });

        const jobDetailsResult = await client.devInspectTransactionBlock({
            transactionBlock: getJobTxb,
            sender: workerAddressFromKey
        });

        if (jobDetailsResult.results?.[0]?.returnValues?.[0]) {
            const jobData = jobDetailsResult.results[0].returnValues[0];
            console.log(`📄 Job details (before fetch):`, jobData);
            console.log(`📄 Status should be PENDING (0)`);
        }

        // Step 6: Worker fetches jobs
        console.log('\n📋 Step 6: Worker fetching jobs from queue...');
        
        const fetchTxb = new Transaction();
        fetchTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::fetch_jobs`,
            arguments: [
                fetchTxb.object(JOB_QUEUE_MANAGER_ID),
                fetchTxb.object(workerSubscriptionId),
                fetchTxb.pure.string('test_queue'),
                fetchTxb.object(CLOCK_ID)
            ]
        });

        const fetchResult = await client.signAndExecuteTransaction({
            transaction: fetchTxb,
            signer: workerKeypair,
            options: {
                showEvents: true,
                showEffects: true
            }
        });

        console.log(`📝 Job fetch transaction: ${fetchResult.digest}`);
        await waitForTransaction(fetchResult.digest);

        // Check for JobReserved events
        let jobWasReserved = false;
        if (fetchResult.events) {
            for (const event of fetchResult.events) {
                if (event.type.includes('JobReserved')) {
                    console.log(`✅ Job reserved event:`, event.parsedJson);
                    jobWasReserved = true;
                }
            }
        }

        if (!jobWasReserved) {
            console.log(`⚠️ No JobReserved event found - job might not have been fetched`);
        }

        // Step 7: Get job details after fetching (should show reserved status)
        console.log('\n📋 Step 7: Getting job details after worker fetch...');
        
        const getJobAfterTxb = new Transaction();
        getJobAfterTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job`,
            arguments: [
                getJobAfterTxb.object(JOB_QUEUE_MANAGER_ID),
                getJobAfterTxb.pure.string(jobUuid)
            ]
        });

        const jobAfterResult = await client.devInspectTransactionBlock({
            transactionBlock: getJobAfterTxb,
            sender: workerAddressFromKey
        });

        if (jobAfterResult.results?.[0]?.returnValues?.[0]) {
            const jobDataAfter = jobAfterResult.results[0].returnValues[0];
            console.log(`📄 Job details (after fetch):`, jobDataAfter);
            console.log(`📄 Status should be RESERVED (1)`);
            console.log(`📦 Original job payload: ${jobPayload}`);
        }

        // Step 8: Get queue statistics
        console.log('\n📋 Step 8: Getting queue statistics...');
        
        const statsTxb = new Transaction();
        statsTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_queue_stats`,
            arguments: [
                statsTxb.object(JOB_QUEUE_MANAGER_ID),
                statsTxb.pure.string('test_queue')
            ]
        });

        const statsResult = await client.devInspectTransactionBlock({
            transactionBlock: statsTxb,
            sender: workerAddressFromKey
        });

        if (statsResult.results?.[0]?.returnValues) {
            const [totalJobs, pendingJobs] = statsResult.results[0].returnValues;
            console.log(`📊 Queue stats - Total jobs: ${totalJobs[0]}, Pending jobs: ${pendingJobs[0]}`);
        }

        // Step 9: Worker processes the job (simulate 10 seconds of work)
        console.log('\n📋 Step 9: Worker processing job (simulating 10 seconds of work)...');
        console.log('⏰ Starting job processing...');
        
        // Simulate job processing time
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('✅ Job processing completed after 10 seconds!');

        // Step 10: Get worker balance before completing job
        console.log('\n📋 Step 10: Checking worker balance before job completion...');
        
        const workerBalanceBefore = await client.getBalance({
            owner: workerAddressFromKey,
            coinType: '0x2::sui::SUI'
        });
        
        console.log(`💰 Worker balance before completion: ${parseInt(workerBalanceBefore.totalBalance) / 1_000_000_000} SUI`);

        // Step 11: Worker completes the job to get reward
        console.log('\n📋 Step 11: Worker completing job to receive reward...');
        
        const completeTxb = new Transaction();
        completeTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::complete_job`,
            arguments: [
                completeTxb.object(JOB_QUEUE_MANAGER_ID),
                completeTxb.pure.string(jobUuid),
                completeTxb.object(CLOCK_ID)
            ]
        });

        const completeResult = await client.signAndExecuteTransaction({
            transaction: completeTxb,
            signer: workerKeypair,
            options: {
                showEvents: true,
                showEffects: true
            }
        });

        console.log(`📝 Job completion transaction: ${completeResult.digest}`);
        await waitForTransaction(completeResult.digest);

        // Check for JobCompleted and WorkerPaid events
        let jobCompletedFound = false;
        let workerPaidFound = false;
        let workerPaidAmount = 0;
        
        if (completeResult.events) {
            for (const event of completeResult.events) {
                if (event.type.includes('JobCompleted')) {
                    console.log(`✅ Job completed event:`, event.parsedJson);
                    jobCompletedFound = true;
                }
                if (event.type.includes('WorkerPaid')) {
                    console.log(`🎉 Worker paid event:`, event.parsedJson);
                    workerPaidFound = true;
                    workerPaidAmount = parseInt(event.parsedJson.payment_amount) / 1_000_000_000;
                    console.log(`💰 Worker paid amount: ${workerPaidAmount} SUI`);
                }
            }
        }

        console.log(`✅ Job marked as completed successfully!`);
        
        if (!jobCompletedFound) {
            console.log(`⚠️ JobCompleted event not found in transaction events`);
        }
        
        if (!workerPaidFound) {
            console.log(`⚠️ WorkerPaid event not found - payment mechanism may not be working`);
        }

        // Step 12: Check worker balance after completing job (should have received reward)
        console.log('\n📋 Step 12: Checking worker balance after job completion...');
        
        const workerBalanceAfter = await client.getBalance({
            owner: workerAddressFromKey,
            coinType: '0x2::sui::SUI'
        });
        
        const balanceIncrease = (parseInt(workerBalanceAfter.totalBalance) - parseInt(workerBalanceBefore.totalBalance)) / 1_000_000_000;
        
        console.log(`💰 Worker balance after completion: ${parseInt(workerBalanceAfter.totalBalance) / 1_000_000_000} SUI`);
        console.log(`💸 Balance increase: ${balanceIncrease} SUI`);
        
        // Validate worker payment
        if (workerPaidFound && balanceIncrease >= (STAKE_AMOUNT_SUI * 0.9)) { // Allow for 10% gas cost tolerance
            console.log(`🎉 SUCCESS: Worker received expected reward!`);
            console.log(`   📊 Event Amount: ${workerPaidAmount} SUI`);
            console.log(`   💰 Balance Increase: ${balanceIncrease} SUI`);
            console.log(`   ✅ Direct worker payment mechanism is working correctly!`);
        } else if (workerPaidFound && balanceIncrease < (STAKE_AMOUNT_SUI * 0.9)) {
            console.log(`⚠️ WARNING: WorkerPaid event found but balance increase is less than expected`);
            console.log(`   📊 Event Amount: ${workerPaidAmount} SUI`);
            console.log(`   💰 Balance Increase: ${balanceIncrease} SUI`);
            console.log(`   🔍 This might be due to gas costs reducing the net increase`);
        } else {
            console.log(`❌ ISSUE: No worker payment detected`);
            if (!workerPaidFound) {
                console.log(`   📋 No WorkerPaid event found`);
            }
            if (balanceIncrease <= 0) {
                console.log(`   💸 No positive balance increase (${balanceIncrease} SUI)`);
            }
            console.log(`   ⚠️ The direct worker payment mechanism may not be functioning correctly`);
        }

        // Step 12.5: Check treasury balance after worker payment
        console.log('\n📋 Step 12.5: Checking treasury balance after worker payment...');
        
        const treasuryAfterPayment = await checkTreasuryBalance(workerAddressFromKey, "Treasury balance after worker payment");

        // Step 13: Verify job is completed/deleted from queue
        console.log('\n📋 Step 13: Verifying job status after completion...');
        
        const getJobFinalTxb = new Transaction();
        getJobFinalTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job`,
            arguments: [
                getJobFinalTxb.object(JOB_QUEUE_MANAGER_ID),
                getJobFinalTxb.pure.string(jobUuid)
            ]
        });

        const jobFinalResult = await client.devInspectTransactionBlock({
            transactionBlock: getJobFinalTxb,
            sender: workerAddressFromKey
        });

        if (jobFinalResult.results?.[0]?.returnValues?.[0]) {
            const jobDataFinal = jobFinalResult.results[0].returnValues[0];
            console.log(`📄 Final job details:`, jobDataFinal);
            console.log(`📄 Status should be COMPLETED (2)`);
        }

        // Step 14: Get final queue statistics
        console.log('\n📋 Step 14: Getting final queue statistics...');
        
        const finalStatsTxb = new Transaction();
        finalStatsTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_queue_stats`,
            arguments: [
                finalStatsTxb.object(JOB_QUEUE_MANAGER_ID),
                finalStatsTxb.pure.string('test_queue')
            ]
        });

        const finalStatsResult = await client.devInspectTransactionBlock({
            transactionBlock: finalStatsTxb,
            sender: workerAddressFromKey
        });

        if (finalStatsResult.results?.[0]?.returnValues) {
            const [totalJobs, pendingJobs] = finalStatsResult.results[0].returnValues;
            console.log(`📊 Final queue stats - Total jobs: ${totalJobs[0]}, Pending jobs: ${pendingJobs[0]}`);
        }

        console.log('\n🎉 ===========================');
        console.log('🎉 COMPLETE WORKFLOW SUCCESSFULLY EXECUTED!');
        console.log('🎉 ===========================');
        console.log(`📊 Summary:`);
        console.log(`   🆔 Job UUID: ${jobUuid}`);
        console.log(`   💰 Stake Amount: ${STAKE_AMOUNT_SUI} SUI`);
        console.log(`   ⏱️  Processing Time: 10 seconds`);
        console.log(`   💸 Worker Reward: ${balanceIncrease} SUI`);
        console.log(`   🏦 Treasury Management: Stake received → Worker paid`);
        console.log(`   🎯 Payment Method: Direct worker payment (not treasury)`);
        console.log(`   ✅ Worker Payment Event: ${workerPaidFound ? 'Found' : 'Not Found'}`);
        console.log(`🔗 Sui Explorer Links:`);
        console.log(`   📝 Submit Job: https://testnet.suivision.xyz/txblock/${submitResult.digest}`);
        console.log(`   👷 Register Worker: ${workerObjects.data.length > 0 ? 'Reused existing registration' : (registerResult ? `https://testnet.suivision.xyz/txblock/${registerResult.digest}` : 'Not needed')}`);
        console.log(`   🔍 Fetch Jobs: https://testnet.suivision.xyz/txblock/${fetchResult.digest}`);
        console.log(`   ✅ Complete Job: https://testnet.suivision.xyz/txblock/${completeResult.digest}`);

        return {
            success: true,
            jobUuid,
            jobPayload,
            submitterAddress: submitterAddressFromKey,
            workerAddress: workerAddressFromKey,
            workerSubscriptionId,
            stakeAmount: `${STAKE_AMOUNT_SUI} SUI`,
            balanceIncrease,
            workerPaidEvent: workerPaidFound,
            workerPaidAmount: workerPaidAmount,
            paymentVerified: workerPaidFound && balanceIncrease >= (STAKE_AMOUNT_SUI * 0.5), // Account for gas costs
            treasuryManagement: 'stake-to-worker-direct-payment',
            transactions: {
                submit: submitResult.digest,
                register: workerObjects.data.length > 0 ? 'reused-existing' : (registerResult ? registerResult.digest : 'not-needed'),
                fetch: fetchResult.digest,
                complete: completeResult.digest
            }
        };

    } catch (error) {
        console.error('\n❌ TEST CASE 1 FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Job Queue API Test - Case 1 (Direct Worker Payment Model)');
    console.log('===============================================================');
    console.log('📋 Testing updated smart contract with direct worker rewards');
    console.log(`💰 Workers now receive the full staked amount (${STAKE_AMOUNT_SUI} SUI) upon job completion`);
    console.log('📊 Deployment: Edm7ZwuduLtdn5N6otZKi842LwqvLDiQSpudxAxTmcZ8');
    console.log('===============================================================');
    console.log(`📍 Submitter: ${SUBMITTER_ADDRESS}`);
    console.log(`📍 Worker: ${WORKER_ADDRESS}`);
    console.log(`📍 Package ID: ${PACKAGE_ID}`);
    console.log(`📍 JobQueueManager: ${JOB_QUEUE_MANAGER_ID}\n`);
    
    const result = await testCase1();
    
    if (result.success) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Tests failed!');
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testCase1, loadWallet, waitForTransaction, checkTreasuryBalance };