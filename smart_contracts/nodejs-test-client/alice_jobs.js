/**
 * Alice Jobs Lister - List all jobs owned by Alice
 * 
 * This script demonstrates how to:
 * 1. Query for JobSubmitted events by Alice's address
 * 2. Retrieve job objects created by Alice
 * 3. Display job details including payloads
 */

const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { fromBase64 } = require('@mysten/sui/utils');
const fs = require('fs');
const path = require('path');

// Contract constants from deployment
const PACKAGE_ID = '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383';
const MANAGER_ID = '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458';
const CLOCK_ID = '0x6';

// Initialize client
const client = new SuiClient({ url: getFullnodeUrl('testnet') });

// Helper function to load wallet (reused from case1.js)
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

// Helper function to check SUI balance
async function getSuiBalance(address) {
    const balance = await client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
    });
    return Number(balance.totalBalance) / 1000000000; // Convert MIST to SUI
}

// Helper function to format job status
function getJobStatusString(status) {
    switch (status) {
        case 0: return 'PENDING';
        case 1: return 'CLAIMED';
        case 2: return 'COMPLETED';
        case 3: return 'VERIFIED';
        default: return 'UNKNOWN';
    }
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(Number(timestamp)).toISOString();
}

// Helper function to parse job payload safely
function parseJobPayload(description) {
    try {
        // Try to parse as JSON first
        const parsed = JSON.parse(description);
        return JSON.stringify(parsed, null, 2);
    } catch {
        // If not JSON, return as-is
        return description;
    }
}

// Get job details using devInspectTransactionBlock
async function getJobDetails(jobId) {
    try {
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job_details`,
            arguments: [txb.object(jobId)],
        });

        const result = await client.devInspectTransactionBlock({
            transactionBlock: txb,
            sender: '0x0000000000000000000000000000000000000000000000000000000000000000', // dummy sender for inspection
        });

        if (result.results && result.results[0] && result.results[0].returnValues) {
            const returnValues = result.results[0].returnValues;
            
            // Parse return values: [description, reward_amount, submitter, worker, result, status]
            const description = returnValues[0] ? Buffer.from(returnValues[0][0].slice(1)).toString('utf8') : '';
            const rewardAmount = returnValues[1] ? Number(returnValues[1][0]) : 0;
            const submitter = returnValues[2] ? '0x' + Buffer.from(returnValues[2][0]).toString('hex') : '';
            const worker = returnValues[3] && returnValues[3][0].length > 1 ? 
                '0x' + Buffer.from(returnValues[3][0].slice(1)).toString('hex') : null;
            const jobResult = returnValues[4] && returnValues[4][0].length > 1 ? 
                Buffer.from(returnValues[4][0].slice(1)).toString('utf8') : null;
            const status = returnValues[5] ? returnValues[5][0][0] : 0;

            return {
                description,
                rewardAmount: rewardAmount / 1000000000, // Convert MIST to SUI
                submitter,
                worker,
                result: jobResult,
                status
            };
        }
    } catch (error) {
        console.error(`Error getting job details for ${jobId}:`, error.message);
        return null;
    }
    return null;
}

// Get job timestamps
async function getJobTimestamps(jobId) {
    try {
        const txb = new Transaction();
        txb.moveCall({
            target: `${PACKAGE_ID}::job_queue::get_job_timestamps`,
            arguments: [txb.object(jobId)],
        });

        const result = await client.devInspectTransactionBlock({
            transactionBlock: txb,
            sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
        });

        if (result.results && result.results[0] && result.results[0].returnValues) {
            const returnValues = result.results[0].returnValues;
            
            // Parse return values: [created_at, claimed_at, completed_at]
            const createdAt = returnValues[0] ? Number(returnValues[0][0]) : null;
            const claimedAt = returnValues[1] && returnValues[1][0].length > 1 ? 
                Number(returnValues[1][0].slice(1)) : null;
            const completedAt = returnValues[2] && returnValues[2][0].length > 1 ? 
                Number(returnValues[2][0].slice(1)) : null;

            return {
                createdAt,
                claimedAt,
                completedAt
            };
        }
    } catch (error) {
        console.error(`Error getting job timestamps for ${jobId}:`, error.message);
        return null;
    }
    return null;
}

// Query for JobSubmitted events by Alice
async function getJobsSubmittedByAlice(aliceAddress) {
    console.log(`🔍 Searching for jobs submitted by Alice (${aliceAddress})...`);
    
    try {
        // Query for JobSubmitted events
        const events = await client.queryEvents({
            query: {
                MoveEventType: `${PACKAGE_ID}::job_queue::JobSubmitted`
            },
            limit: 50, // Adjust as needed
            order: 'descending'
        });

        console.log(`📊 Found ${events.data.length} total JobSubmitted events`);

        // Filter events by Alice's address
        const aliceJobs = events.data.filter(event => {
            const eventData = event.parsedJson;
            return eventData && eventData.submitter === aliceAddress;
        });

        console.log(`👩 Found ${aliceJobs.length} jobs submitted by Alice\n`);

        return aliceJobs;
    } catch (error) {
        console.error('❌ Error querying JobSubmitted events:', error.message);
        return [];
    }
}

// Alternative method: Get jobs owned by Alice by checking all shared objects
async function getJobsOwnedByAlice(aliceAddress) {
    console.log(`🔍 Alternative method: Searching for job objects where Alice is the submitter...`);
    
    try {
        // Get all objects of Job type
        // Note: This is a more comprehensive approach but may be slower
        const objects = await client.getOwnedObjects({
            owner: aliceAddress,
            filter: {
                StructType: `${PACKAGE_ID}::job_queue::Job`
            },
            options: {
                showContent: true,
                showType: true
            }
        });

        console.log(`📊 Found ${objects.data.length} job objects owned by Alice\n`);
        return objects.data;
    } catch (error) {
        console.error('❌ Error querying owned objects:', error.message);
        
        // If direct ownership query fails, try querying all Job objects
        // and filter by submitter (this is less efficient but more comprehensive)
        console.log('🔄 Falling back to event-based search...');
        return [];
    }
}

// Main function to list Alice's jobs
async function listAliceJobs() {
    console.log('🚀 Starting Alice Jobs Lister');
    console.log('=' .repeat(60));
    
    try {
        // Load Alice's wallet
        console.log('📝 Loading Alice\'s wallet...');
        const alice = loadWallet('Alice');
        console.log(`👩 Alice address: ${alice.address}`);
        
        // Check Alice's balance
        const balance = await getSuiBalance(alice.address);
        console.log(`💰 Alice's current balance: ${balance.toFixed(4)} SUI\n`);
        
        // Method 1: Query JobSubmitted events
        const jobEvents = await getJobsSubmittedByAlice(alice.address);
        
        if (jobEvents.length === 0) {
            console.log('📭 No jobs found for Alice using event query.');
            
            // Method 2: Try alternative approach
            const ownedObjects = await getJobsOwnedByAlice(alice.address);
            
            if (ownedObjects.length === 0) {
                console.log('📭 No job objects found owned by Alice either.');
                console.log('\n💡 This could mean:');
                console.log('   - Alice hasn\'t submitted any jobs yet');
                console.log('   - All jobs have been deleted after completion');
                console.log('   - Jobs exist but are stored as shared objects (not owned objects)');
                return;
            }
        }
        
        // Display job details
        console.log('📋 Alice\'s Job Details:');
        console.log('=' .repeat(60));
        
        for (let i = 0; i < jobEvents.length; i++) {
            const event = jobEvents[i];
            const eventData = event.parsedJson;
            const jobId = eventData.job_id;
            
            console.log(`\n🆔 Job #${i + 1}`);
            console.log(`   Job ID: ${jobId}`);
            console.log(`   Event ID: ${event.id.eventSeq}`);
            console.log(`   Transaction: ${event.id.txDigest}`);
            console.log(`   Timestamp: ${formatTimestamp(event.timestampMs)}`);
            
            // Get detailed job information
            const jobDetails = await getJobDetails(jobId);
            const jobTimestamps = await getJobTimestamps(jobId);
            
            if (jobDetails) {
                console.log(`   Status: ${getJobStatusString(jobDetails.status)}`);
                console.log(`   Reward: ${jobDetails.rewardAmount.toFixed(4)} SUI`);
                console.log(`   Worker: ${jobDetails.worker || 'None'}`);
                
                if (jobTimestamps) {
                    console.log(`   Created: ${formatTimestamp(jobTimestamps.createdAt)}`);
                    if (jobTimestamps.claimedAt) {
                        console.log(`   Claimed: ${formatTimestamp(jobTimestamps.claimedAt)}`);
                    }
                    if (jobTimestamps.completedAt) {
                        console.log(`   Completed: ${formatTimestamp(jobTimestamps.completedAt)}`);
                    }
                }
                
                console.log(`\n   📦 Job Payload:`);
                console.log('   ' + '-'.repeat(50));
                const formattedPayload = parseJobPayload(jobDetails.description);
                // Indent each line of the payload
                const indentedPayload = formattedPayload.split('\n').map(line => `   ${line}`).join('\n');
                console.log(indentedPayload);
                
                if (jobDetails.result) {
                    console.log(`\n   ✅ Job Result:`);
                    console.log('   ' + '-'.repeat(50));
                    console.log(`   ${jobDetails.result}`);
                }
            } else {
                console.log(`   ⚠️  Unable to fetch detailed job information`);
                console.log(`   📦 Basic Payload from event: ${eventData.description || 'N/A'}`);
            }
            
            console.log('\n' + '='.repeat(60));
        }
        
        // Summary
        console.log(`\n📊 Summary:`);
        console.log(`   Total jobs found: ${jobEvents.length}`);
        
        if (jobEvents.length > 0) {
            const statusCounts = {};
            let totalRewards = 0;
            
            for (const event of jobEvents) {
                const jobId = event.parsedJson.job_id;
                const jobDetails = await getJobDetails(jobId);
                
                if (jobDetails) {
                    const statusStr = getJobStatusString(jobDetails.status);
                    statusCounts[statusStr] = (statusCounts[statusStr] || 0) + 1;
                    totalRewards += jobDetails.rewardAmount;
                }
            }
            
            console.log(`   Status breakdown:`);
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`     ${status}: ${count}`);
            });
            console.log(`   Total rewards allocated: ${totalRewards.toFixed(4)} SUI`);
        }
        
        console.log(`\n🎉 Alice Jobs Listing Completed!`);
        
    } catch (error) {
        console.error('❌ Error listing Alice\'s jobs:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    listAliceJobs();
}

module.exports = { listAliceJobs, getJobsSubmittedByAlice, getJobDetails };
