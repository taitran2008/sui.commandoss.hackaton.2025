/**
 * Case 2: Job Rejection and Reassignment Workflow Test
 * 
 * Scenario:
 * 1. Alice submits a job: "Translate 100 words into French" with 0.1 SUI reward (30 min timeout)
 * 2. Bob claims the job and has 30 minutes to complete it
 * 3. Bob finishes it in 5 minutes (simulated with sleep)
 * 4. Alice checks the result and rejects it
 * 5. Job becomes available to another worker then Carol takes it
 * 6. Carol claims the job and has 30 minutes to complete it
 * 7. Carol finishes it in 5 minutes (simulated with sleep)
 * 8. Alice checks the result and calls verify_and_release, transferring 0.1 SUI to Carol
 * 9. The job object is deleted → storage rebate issued
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
async function runCase2Test() {
    console.log('🚀 Starting Case 2: Job Rejection and Reassignment Workflow Test');
    console.log('=' .repeat(70));
    
    try {
        // Load wallets
        console.log('📝 Loading wallets...');
        const alice = loadWallet('Alice');
        const bob = loadWallet('Bob');
        const carol = loadWallet('Carol');
        
        console.log(`👩 Alice address: ${alice.address}`);
        console.log(`👨 Bob address: ${bob.address}`);
        console.log(`👩 Carol address: ${carol.address}`);
        
        // Check initial balances
        const aliceInitialBalance = await getSuiBalance(alice.address);
        const bobInitialBalance = await getSuiBalance(bob.address);
        const carolInitialBalance = await getSuiBalance(carol.address);
        
        console.log(`💰 Alice initial balance: ${aliceInitialBalance.toFixed(4)} SUI`);
        console.log(`💰 Bob initial balance: ${bobInitialBalance.toFixed(4)} SUI`);
        console.log(`💰 Carol initial balance: ${carolInitialBalance.toFixed(4)} SUI`);
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
            timestamp: new Date().toISOString()
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
        
        // Step 2: Bob claims the job
        console.log('🎯 Step 2: Bob claims the job...');
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
            signer: bob.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(claimResult)) {
            throw new Error('Job claim failed');
        }
        
        console.log('✅ Job claimed successfully by Bob!');
        
        // Check for JobClaimed event
        const claimEvent = claimResult.events?.find(e => e.type.includes('JobClaimed'));
        if (claimEvent) {
            console.log(`📢 JobClaimed event: ${JSON.stringify(claimEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Step 3: Bob works on the job (simulate 5 minutes of work)
        console.log('⏳ Step 3: Bob is working on the translation (simulating 5 minutes)...');
        await sleep(5); // Sleep for 5 seconds to simulate 5 minutes of work
        console.log('✅ Bob completed the work!');
        console.log('');
        
        // Step 4: Bob submits the completed work (poor quality)
        console.log('📤 Step 4: Bob submits the completed translation (poor quality work)...');
        const completeTxb = new Transaction();
        completeTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::complete_job`,
            arguments: [
                completeTxb.object(jobId),
                completeTxb.pure.string("French words here badly translated nonsense"),
                completeTxb.object(CLOCK_ID),
            ],
        });
        
        const completeResult = await client.signAndExecuteTransaction({
            transaction: completeTxb,
            signer: bob.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(completeResult)) {
            throw new Error('Job completion failed');
        }
        
        console.log('✅ Job completed by Bob (but work quality is poor)!');
        
        // Check for JobCompleted event
        const completeEvent = completeResult.events?.find(e => e.type.includes('JobCompleted'));
        if (completeEvent) {
            console.log(`📢 JobCompleted event: ${JSON.stringify(completeEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Step 5: Alice checks the result and rejects it
        console.log('🔍 Step 5: Alice reviews Bob\'s work result...');
        
        // Get job details to see the result
        const jobDetailsTxb = new Transaction();
        jobDetailsTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job_details`,
            arguments: [jobDetailsTxb.object(jobId)],
        });
        
        const jobDetailsResult = await client.devInspectTransactionBlock({
            transactionBlock: jobDetailsTxb,
            sender: alice.address,
        });
        
        if (jobDetailsResult.results && jobDetailsResult.results[0]) {
            const returnValues = jobDetailsResult.results[0].returnValues;
            if (returnValues && returnValues.length >= 5) {
                // Parse the result (it's the 5th element, index 4)
                const resultBytes = returnValues[4][0];
                if (resultBytes && resultBytes.length > 1) {
                    // Skip the first byte (vector length) and convert rest to string
                    const resultStr = Buffer.from(resultBytes.slice(1)).toString('utf8');
                    console.log(`📄 Bob's Work Result: "${resultStr}"`);
                } else {
                    console.log('📄 Bob\'s Work Result: (empty or not available)');
                }
            } else {
                console.log('📄 Bob\'s Work Result: (unable to parse return values)');
            }
        } else {
            console.log('📄 Bob\'s Work Result: (transaction inspection failed)');
        }
        
        console.log('❌ Alice is NOT satisfied with Bob\'s work quality and will reject it...');
        
        // Alice rejects the work
        console.log('🚫 Alice rejects Bob\'s work...');
        const rejectTxb = new Transaction();
        rejectTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::reject_job`,
            arguments: [
                rejectTxb.object(MANAGER_ID),
                rejectTxb.object(jobId),
                rejectTxb.pure.string("Poor quality translation, does not meet requirements"),
                rejectTxb.object(CLOCK_ID),
            ],
        });
        
        const rejectResult = await client.signAndExecuteTransaction({
            transaction: rejectTxb,
            signer: alice.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(rejectResult)) {
            throw new Error('Job rejection failed');
        }
        
        console.log('✅ Job rejected successfully! Job is now available for other workers.');
        
        // Check for JobRejected event
        const rejectEvent = rejectResult.events?.find(e => e.type.includes('JobRejected'));
        if (rejectEvent) {
            console.log(`📢 JobRejected event: ${JSON.stringify(rejectEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for the rejection to be finalized
        console.log('⏳ Waiting for rejection to be finalized...');
        await sleep(3);
        
        // Step 6: Carol claims the job
        console.log('🎯 Step 6: Carol claims the now-available job...');
        const carolClaimTxb = new Transaction();
        carolClaimTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::claim_job`,
            arguments: [
                carolClaimTxb.object(MANAGER_ID),
                carolClaimTxb.object(jobId),
                carolClaimTxb.object(CLOCK_ID),
            ],
        });
        
        const carolClaimResult = await client.signAndExecuteTransaction({
            transaction: carolClaimTxb,
            signer: carol.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(carolClaimResult)) {
            throw new Error('Carol\'s job claim failed');
        }
        
        console.log('✅ Job claimed successfully by Carol!');
        
        // Check for JobClaimed event
        const carolClaimEvent = carolClaimResult.events?.find(e => e.type.includes('JobClaimed'));
        if (carolClaimEvent) {
            console.log(`📢 JobClaimed event: ${JSON.stringify(carolClaimEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Step 7: Carol works on the job (simulate 5 minutes of work)
        console.log('⏳ Step 7: Carol is working on the translation (simulating 5 minutes)...');
        await sleep(5); // Sleep for 5 seconds to simulate 5 minutes of work
        console.log('✅ Carol completed the work!');
        console.log('');
        
        // Step 8: Carol submits the completed work (high quality)
        console.log('📤 Step 8: Carol submits the completed translation (high quality work)...');
        const carolCompleteTxb = new Transaction();
        carolCompleteTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::complete_job`,
            arguments: [
                carolCompleteTxb.object(jobId),
                carolCompleteTxb.pure.string("Traduire cent mots en français - Traduction professionnelle et précise completée avec soin!"),
                carolCompleteTxb.object(CLOCK_ID),
            ],
        });
        
        const carolCompleteResult = await client.signAndExecuteTransaction({
            transaction: carolCompleteTxb,
            signer: carol.keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        
        if (!isTransactionSuccessful(carolCompleteResult)) {
            throw new Error('Carol\'s job completion failed');
        }
        
        console.log('✅ Job completed successfully by Carol!');
        
        // Check for JobCompleted event
        const carolCompleteEvent = carolCompleteResult.events?.find(e => e.type.includes('JobCompleted'));
        if (carolCompleteEvent) {
            console.log(`📢 JobCompleted event: ${JSON.stringify(carolCompleteEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Step 9: Alice checks Carol's result and approves
        console.log('🔍 Step 9: Alice reviews Carol\'s work result...');
        
        // Get job details to see Carol's result
        const carolJobDetailsTxb = new Transaction();
        carolJobDetailsTxb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job_details`,
            arguments: [carolJobDetailsTxb.object(jobId)],
        });
        
        const carolJobDetailsResult = await client.devInspectTransactionBlock({
            transactionBlock: carolJobDetailsTxb,
            sender: alice.address,
        });
        
        if (carolJobDetailsResult.results && carolJobDetailsResult.results[0]) {
            const returnValues = carolJobDetailsResult.results[0].returnValues;
            if (returnValues && returnValues.length >= 5) {
                // Parse the result (it's the 5th element, index 4)
                const resultBytes = returnValues[4][0];
                if (resultBytes && resultBytes.length > 1) {
                    // Skip the first byte (vector length) and convert rest to string
                    const resultStr = Buffer.from(resultBytes.slice(1)).toString('utf8');
                    console.log(`📄 Carol's Work Result: "${resultStr}"`);
                } else {
                    console.log('📄 Carol\'s Work Result: (empty or not available)');
                }
            } else {
                console.log('📄 Carol\'s Work Result: (unable to parse return values)');
            }
        } else {
            console.log('📄 Carol\'s Work Result: (transaction inspection failed)');
        }
        
        console.log('✅ Alice is satisfied with Carol\'s excellent work and will release payment...');
        console.log('');
        
        // Wait a moment to ensure completion is finalized
        console.log('⏳ Waiting for completion to be finalized...');
        await sleep(3);
        
        // Step 10: Alice verifies and releases payment to Carol
        console.log('💸 Step 10: Alice verifies and releases 0.1 SUI payment to Carol...');
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
            throw new Error('Payment verification and release failed');
        }
        
        console.log('✅ Payment released successfully to Carol!');
        
        // Check for JobVerified event
        const verifyEvent = verifyResult.events?.find(e => e.type.includes('JobVerified'));
        if (verifyEvent) {
            console.log(`📢 JobVerified event: ${JSON.stringify(verifyEvent.parsedJson, null, 2)}`);
        }
        console.log('');
        
        // Wait a moment for verification to be finalized
        console.log('⏳ Waiting for verification to be finalized...');
        await sleep(3);
        
        // Step 11: Delete the job for storage rebate
        console.log('🗑️  Step 11: Deleting job to reclaim storage rebate...');
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
        
        // Check final balances
        console.log('💰 Final Balance Check:');
        const aliceFinalBalance = await getSuiBalance(alice.address);
        const bobFinalBalance = await getSuiBalance(bob.address);
        const carolFinalBalance = await getSuiBalance(carol.address);
        
        console.log(`👩 Alice final balance: ${aliceFinalBalance.toFixed(4)} SUI (Change: ${(aliceFinalBalance - aliceInitialBalance).toFixed(4)} SUI)`);
        console.log(`👨 Bob final balance: ${bobFinalBalance.toFixed(4)} SUI (Change: ${(bobFinalBalance - bobInitialBalance).toFixed(4)} SUI)`);
        console.log(`👩 Carol final balance: ${carolFinalBalance.toFixed(4)} SUI (Change: ${(carolFinalBalance - carolInitialBalance).toFixed(4)} SUI)`);
        
        console.log('');
        console.log('🎉 Case 2 Test Completed Successfully!');
        console.log('Summary:');
        console.log('- ✅ Alice submitted a translation job with 0.1 SUI reward');
        console.log('- ✅ Bob claimed and completed the job but with poor quality work');
        console.log('- ✅ Alice rejected Bob\'s work, making the job available again');
        console.log('- ✅ Carol claimed the job and completed it with high quality work');
        console.log('- ✅ Alice verified Carol\'s work and released payment');
        console.log('- ✅ Job was deleted and storage rebate was issued');
        console.log('- ✅ Carol received 0.1 SUI for completing the translation correctly');
        console.log('- ✅ Bob received nothing due to rejected work');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runCase2Test();
}

module.exports = { runCase2Test };
