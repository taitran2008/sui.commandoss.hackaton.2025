/**
 * Case 4: Job Self-Verification and Cancellation Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30 min timeout)
 * 2. Alice realizes she made a mistake and wants to cancel it
 * 3. Since only VERIFIED jobs can be deleted, Alice implements a "self-verification" workflow:
 *    a) Alice claims her own job
 *    b) Alice completes the job with a cancellation message
 *    c) Alice verifies and releases payment to herself
 *    d) Alice deletes the VERIFIED job to get storage rebate
 * 4. This demonstrates the proper way to "cancel" a job in the smart contract system
 * 
 * Key Learning: The smart contract allows self-verification as a cancellation mechanism
 * while maintaining payment integrity and preventing system abuse.
 */

const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { fromBase64 } = require('@mysten/sui/utils');
const fs = require('fs');
const path = require('path');

// Contract constants from deployment
const PACKAGE_ID = '0xf6869ff5c7ed0c8f89a0890c502cfe0446240c1dc8babe275532ecff2c4b2b63';
const MANAGER_ID = '0x178ce7cbd06f907cfd99e8b2dac27b352e032f66dadae77a5aed77df95572e29';
const CLOCK_ID = '0x6';

// Initialize client
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// Helper function to load wallet
function loadWallet(walletName) {
    const walletDir = path.join('./wallets', walletName);
    const files = fs.readdirSync(walletDir);
    const addressFile = files.find(f => f.startsWith('0x'));
    
    if (!addressFile) {
        throw new Error(`No address file found in wallet ${walletName}`);
    }
    
    const privateKeyB64 = fs.readFileSync(path.join(walletDir, addressFile), 'utf8').trim();
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKeyB64));
    
    return {
        keypair,
        address: addressFile
    };
}

// Helper function to generate a unique job UUID
function generateJobUuid() {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Helper function to check transaction success
function isTransactionSuccessful(txResult) {
    return txResult.effects?.status?.status === 'success';
}

// Helper function to sleep
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Helper function to check SUI balance
async function getSuiBalance(address) {
    const balance = await client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
    });
    return Number(balance.totalBalance) / 1000000000; // Convert MIST to SUI
}

// Main test function
async function runCancelJobTest() {
    console.log('🚀 Starting Case 4: Job Self-Verification Cancellation Test');
    console.log('=' .repeat(60));
    
    try {
        // Load wallet
        console.log('📝 Loading wallet...');
        const alice = loadWallet('Alice');
        
        console.log(`👩 Alice address: ${alice.address}`);
        
        // Check initial balance
        const aliceInitialBalance = await getSuiBalance(alice.address);
        
        console.log(`💰 Alice initial balance: ${aliceInitialBalance.toFixed(4)} SUI`);
        console.log('');
        
        // Step 1: Alice submits a job
        console.log('📋 Step 1: Alice submits a translation job...');
        const jobUuid = generateJobUuid();
        const jobPayload = JSON.stringify({
            task: "translation",
            text: "Translate 100 words into French",
            language_pair: "en-fr",
            word_count: 100,
            urgency: "standard",
            timestamp: new Date().toISOString(),
            note: "This job contains a mistake and will be cancelled via self-verification"
        });
        
        console.log(`🆔 Job UUID: ${jobUuid}`);
        console.log(`📦 Job Payload: ${jobPayload}`);
        
        const submitTxb = new Transaction();
        const [coin] = submitTxb.splitCoins(submitTxb.gas, [submitTxb.pure.u64(100000000)]); // 0.1 SUI
        
        submitTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::submit_job`,
            arguments: [
                submitTxb.object(MANAGER_ID),
                submitTxb.pure.string(jobPayload), // description parameter
                coin, // reward parameter
                submitTxb.pure.u64(30), // timeout_minutes parameter (30 minutes)
                submitTxb.object(CLOCK_ID),
            ],
        });
        
        const submitResult = await client.signAndExecuteTransaction({
            transaction: submitTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(submitResult)) {
            throw new Error('Job submission failed');
        }
        
        console.log(`✅ Job submitted successfully! Job UUID: ${jobUuid}`);
        
        // Extract the job object ID from the created objects
        let jobId = null;
        if (submitResult.effects && submitResult.effects.created) {
            const createdObjects = submitResult.effects.created;
            // Find the job object (exclude the manager and other system objects)
            const jobObject = createdObjects.find(obj => 
                obj.owner && typeof obj.owner === 'object' && obj.owner.Shared
            );
            if (jobObject) {
                jobId = jobObject.reference.objectId;
                console.log(`🆔 Job Object ID: ${jobId}`);
            }
        }
        
        if (!jobId) {
            throw new Error('Could not find job object ID in transaction results');
        }
        
        // Check for JobSubmitted event
        const submitEvent = submitResult.events?.find(e => e.type.includes('JobSubmitted'));
        if (submitEvent) {
            console.log(`📢 JobSubmitted event: ${JSON.stringify(submitEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for the object to be finalized on-chain
        console.log('⏳ Waiting for object to be finalized...');
        await sleep(3);
        
        // Verify the job object exists and check its status
        try {
            const jobObject = await client.getObject({
                id: jobId,
                options: { showContent: true }
            });
            console.log(`🔍 Job object status: ${jobObject.data ? 'exists' : 'not found'}`);
            
            if (jobObject.data && jobObject.data.content) {
                const jobFields = jobObject.data.content.fields;
                console.log(`🔍 Job status: ${jobFields.status} (Expected: 0 for PENDING)`);
                console.log(`🔍 Job submitter: ${jobFields.submitter}`);
                console.log(`🔍 Job reward: ${jobFields.reward.fields.value} MIST`);
            }
        } catch (error) {
            console.log(`⚠️ Warning: Could not verify job object: ${error.message}`);
        }
        console.log('');
        
        // Step 2: Alice realizes there's a mistake and decides to cancel via self-verification
        console.log('🛑 Step 2: Alice realizes there\'s a mistake and cancels via self-verification...');
        console.log('💭 Alice: "Oh no! I made a mistake in the job description. I\'ll cancel this by self-verifying."');
        console.log('📝 Strategy: Claim → Complete → Verify → Delete workflow');
        console.log('');
        
        // Step 3: Alice claims her own job
        console.log('🎯 Step 3: Alice claims her own job...');
        const claimTxb = new Transaction();
        claimTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::claim_job`,
            arguments: [
                claimTxb.object(MANAGER_ID),
                claimTxb.object(jobId),
                claimTxb.object(CLOCK_ID),
            ],
        });
        
        const claimResult = await client.signAndExecuteTransaction({
            transaction: claimTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(claimResult)) {
            throw new Error('Job claiming failed');
        }
        
        console.log('✅ Alice successfully claimed her own job!');
        
        // Check for JobClaimed event
        const claimEvent = claimResult.events?.find(e => e.type.includes('JobClaimed'));
        if (claimEvent) {
            console.log(`📢 JobClaimed event: ${JSON.stringify(claimEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for the claim to be finalized
        console.log('⏳ Waiting for claim to be finalized...');
        await sleep(3);
        
        // Step 4: Alice completes the job with a cancellation message
        console.log('✅ Step 4: Alice marks the job as completed with cancellation message...');
        const completeTxb = new Transaction();
        completeTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::complete_job`,
            arguments: [
                completeTxb.object(jobId),
                completeTxb.pure.string("JOB CANCELLED BY SUBMITTER - Self-verification for deletion"),
                completeTxb.object(CLOCK_ID),
            ],
        });
        
        const completeResult = await client.signAndExecuteTransaction({
            transaction: completeTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(completeResult)) {
            throw new Error('Job completion failed');
        }
        
        console.log('✅ Alice marked the job as completed with cancellation message!');
        
        // Check for JobCompleted event
        const completeEvent = completeResult.events?.find(e => e.type.includes('JobCompleted'));
        if (completeEvent) {
            console.log(`📢 JobCompleted event: ${JSON.stringify(completeEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for the completion to be finalized
        console.log('⏳ Waiting for completion to be finalized...');
        await sleep(3);
        
        // Step 5: Alice verifies and releases payment to herself
        console.log('💸 Step 5: Alice verifies and releases payment to herself...');
        const verifyTxb = new Transaction();
        verifyTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::verify_and_release`,
            arguments: [
                verifyTxb.object(jobId),
                verifyTxb.object(CLOCK_ID),
            ],
        });
        
        const verifyResult = await client.signAndExecuteTransaction({
            transaction: verifyTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(verifyResult)) {
            throw new Error('Job verification failed');
        }
        
        console.log('✅ Alice verified and released payment to herself!');
        
        // Check for JobVerified event
        const verifyEvent = verifyResult.events?.find(e => e.type.includes('JobVerified'));
        if (verifyEvent) {
            console.log(`📢 JobVerified event: ${JSON.stringify(verifyEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for the verification to be finalized
        console.log('⏳ Waiting for verification to be finalized...');
        await sleep(3);
        
        // Step 6: Alice deletes the VERIFIED job to get storage rebate
        console.log('🗑️ Step 6: Alice deletes the VERIFIED job to reclaim storage rebate...');
        const deleteTxb = new Transaction();
        deleteTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::delete_job`,
            arguments: [deleteTxb.object(jobId)],
        });
        
        const deleteResult = await client.signAndExecuteTransaction({
            transaction: deleteTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(deleteResult)) {
            throw new Error('Job deletion failed');
        }
        
        console.log('✅ Job deleted successfully! Storage rebate issued.');
        console.log('');
        
        // Step 7: Final balance check and verification
        console.log('💰 Step 7: Final Balance Check and System State:');
        
        // Check that the job object no longer exists
        try {
            const jobObjectAfterDelete = await client.getObject({
                id: jobId,
                options: { showContent: true }
            });
            
            if (jobObjectAfterDelete.data) {
                console.log(`⚠️ Unexpected: Job object still exists after deletion`);
            } else {
                console.log(`✅ Job object successfully deleted from blockchain`);
            }
        } catch (error) {
            console.log(`✅ Job object successfully deleted (no longer exists on chain)`);
        }
        
        // Check final balance
        const aliceFinalBalance = await getSuiBalance(alice.address);
        const balanceChange = aliceFinalBalance - aliceInitialBalance;
        
        console.log(`👩 Alice final balance: ${aliceFinalBalance.toFixed(4)} SUI`);
        console.log(`💸 Balance change: ${balanceChange.toFixed(4)} SUI`);
        
        if (balanceChange >= -0.01) { // Should be close to original due to self-payment
            console.log('📊 Alice successfully recovered her 0.1 SUI reward through self-verification');
            console.log('📝 Only gas fees were deducted for the cancellation workflow');
        }
        
        console.log('');
        console.log('🎉 Case 4 Test Completed Successfully!');
        console.log('Summary:');
        console.log('- ✅ Alice submitted a translation job with 0.1 SUI reward');
        console.log('- ✅ Alice claimed her own job (self-claiming)');
        console.log('- ✅ Alice completed the job with cancellation message');
        console.log('- ✅ Alice verified and released payment to herself');
        console.log('- ✅ Alice deleted the VERIFIED job and got storage rebate');
        console.log('- ✅ Successfully implemented job "cancellation" via self-verification');
        console.log('');
        console.log('📝 Key Learning: The smart contract allows self-verification as a legitimate');
        console.log('   cancellation mechanism. This maintains payment integrity while providing');
        console.log('   flexibility for job submitters to cancel their own work.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runCancelJobTest();
}

module.exports = { runCancelJobTest };
