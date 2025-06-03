// Wallet Jobs Service - Fetch all jobs belonging to a specific wallet address
// Adapted from alice_jobs.js for React frontend

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { CONTRACT_CONFIG, JOB_STATUS_LABELS } from '../constants/contract'

// Initialize client for testnet
const client = new SuiClient({ url: getFullnodeUrl('testnet') })

export interface WalletJob {
  id: string
  name: string
  status: string
  timestamp: string
  rewardAmount?: number
  description?: string
  worker?: string
  result?: string
  createdAt?: number
  claimedAt?: number
  completedAt?: number
  eventId?: string
  transactionDigest?: string
}

// Helper function to format job status
function getJobStatusString(status: number): string {
  return JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] || 'Unknown'
}

// Helper function to format timestamp
function formatTimestamp(timestamp?: string | number): string {
  if (!timestamp) return 'N/A'
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

// Helper function to parse job payload safely
function parseJobDescription(description: string): { name: string; description: string } {
  console.log('Raw job description:', description)
  console.log('Description length:', description.length)
  console.log('First 20 chars as array:', description.slice(0, 20).split('').map(c => c.charCodeAt(0)))
  
  try {
    // Clean the description string by removing any non-printable characters
    let cleanedDescription = description
      .replace(/^\0+/, '') // Remove null bytes at the start
      .replace(/\0+$/, '') // Remove null bytes at the end
      .trim() // Remove whitespace
    
    console.log('Cleaned description:', cleanedDescription)
    
    // Try to find the JSON part if there are extra characters
    const jsonStart = cleanedDescription.indexOf('{')
    const jsonEnd = cleanedDescription.lastIndexOf('}')
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedDescription = cleanedDescription.substring(jsonStart, jsonEnd + 1)
      console.log('Extracted JSON part:', cleanedDescription)
    }
    
    const parsed = JSON.parse(cleanedDescription)
    console.log('Parsed JSON object:', parsed)
    console.log('Task field:', parsed.task)
    console.log('Description field:', parsed.description)
    
    if (typeof parsed === 'object' && parsed !== null) {
      const result = {
        name: parsed.task || parsed.title || parsed.name || 'Job Task',
        description: parsed.description || 'No description available'
      }
      console.log('Returning result:', result)
      return result
    }
    return { name: description, description: description }
  } catch (error) {
    console.error('JSON parsing error:', error)
    console.error('Failed to parse description:', description)
    // If it's not JSON, treat the whole string as the description
    return { name: 'Job Task', description: description || 'No description available' }
  }
}

// Check if an object exists on the blockchain
async function objectExists(objectId: string): Promise<boolean> {
  try {
    const object = await client.getObject({
      id: objectId,
      options: { showType: true }
    })
    return object.data !== null && object.error === undefined
  } catch (error) {
    return false
  }
}

// Get job details using devInspectTransactionBlock
async function getJobDetails(jobId: string): Promise<any> {
  try {
    // First check if the object exists to avoid the "deleted" error
    const exists = await objectExists(jobId)
    if (!exists) {
      console.log(`Job ${jobId} has been deleted or does not exist`)
      return null
    }

    const txb = new Transaction()
    txb.moveCall({
      target: `${CONTRACT_CONFIG.PACKAGE_ID}::job_queue::get_job_details`,
      arguments: [txb.object(jobId)]
    })

    const result = await client.devInspectTransactionBlock({
      transactionBlock: txb,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000'
    })

    if (result.results?.[0]?.returnValues) {
      const returnValues = result.results[0].returnValues
      
      // Parse return values based on smart contract structure
      const description = returnValues[0] ? Buffer.from(returnValues[0][0].slice(1)).toString('utf8') : ''
      const rewardAmount = returnValues[1] ? Number(returnValues[1][0]) : 0
      const submitter = returnValues[2] ? '0x' + Buffer.from(returnValues[2][0]).toString('hex') : ''
      const worker = returnValues[3] && returnValues[3][0].length > 1 ? 
        '0x' + Buffer.from(returnValues[3][0].slice(1)).toString('hex') : null
      const jobResult = returnValues[4] && returnValues[4][0].length > 1 ? 
        Buffer.from(returnValues[4][0].slice(1)).toString('utf8') : null
      const status = returnValues[5] ? returnValues[5][0][0] : 0

      return {
        description,
        rewardAmount: rewardAmount / 1000000000, // Convert MIST to SUI
        submitter,
        worker,
        result: jobResult,
        status
      }
    }
  } catch (error) {
    // Check if the error is due to deleted object
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('deleted') || errorMessage.includes('Invalid object')) {
      console.log(`Job ${jobId} has been deleted`)
      return null
    }
    console.error(`Error getting job details for ${jobId}:`, error)
    return null
  }
  return null
}

// Get job timestamps
async function getJobTimestamps(jobId: string): Promise<any> {
  try {
    // First check if the object exists to avoid the "deleted" error
    const exists = await objectExists(jobId)
    if (!exists) {
      console.log(`Job ${jobId} has been deleted or does not exist`)
      return null
    }

    const txb = new Transaction()
    txb.moveCall({
      target: `${CONTRACT_CONFIG.PACKAGE_ID}::job_queue::get_job_timestamps`,
      arguments: [txb.object(jobId)]
    })

    const result = await client.devInspectTransactionBlock({
      transactionBlock: txb,
      sender: '0x0000000000000000000000000000000000000000000000000000000000000000'
    })

    if (result.results?.[0]?.returnValues) {
      const returnValues = result.results[0].returnValues
      
      const createdAt = returnValues[0] ? Number(returnValues[0][0]) : null
      const claimedAt = returnValues[1] && returnValues[1][0].length > 1 ? 
        Number(returnValues[1][0].slice(1)) : null
      const completedAt = returnValues[2] && returnValues[2][0].length > 1 ? 
        Number(returnValues[2][0].slice(1)) : null

      return {
        createdAt,
        claimedAt,
        completedAt
      }
    }
  } catch (error) {
    // Check if the error is due to deleted object
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('deleted') || errorMessage.includes('Invalid object')) {
      console.log(`Job ${jobId} has been deleted`)
      return null
    }
    console.error(`Error getting job timestamps for ${jobId}:`, error)
    return null
  }
  return null
}

// Main function to fetch jobs for a wallet address
export async function fetchWalletJobs(walletAddress: string): Promise<WalletJob[]> {
  if (!walletAddress) {
    return []
  }

  try {
    console.log(`Fetching jobs for wallet: ${walletAddress}`)
    
    // Query for JobSubmitted events
    const events = await client.queryEvents({
      query: {
        MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::job_queue::JobSubmitted`
      },
      limit: 50,
      order: 'descending'
    })

    // Filter events by wallet address
    const walletJobs = events.data.filter(event => {
      const eventData = event.parsedJson as any
      return eventData && eventData.submitter === walletAddress
    })

    console.log(`Found ${walletJobs.length} jobs for wallet`)

    // Convert events to WalletJob format
    const jobs: WalletJob[] = []
    
    for (const event of walletJobs) {
      const eventData = event.parsedJson as any
      const jobId = eventData.job_id
      
      try {
        // Get detailed job information
        const jobDetails = await getJobDetails(jobId)
        const jobTimestamps = await getJobTimestamps(jobId)
        
        // If job details are null (deleted job), create a special entry
        if (!jobDetails) {
          console.log(`Job ${jobId} appears to be deleted, creating deleted job entry`)
          jobs.push({
            id: jobId,
            name: 'Deleted Job',
            status: 'Deleted',
            timestamp: formatTimestamp(event.timestampMs || undefined),
            description: 'This job has been deleted from the blockchain',
            eventId: event.id.eventSeq || undefined,
            transactionDigest: event.id.txDigest
          })
          continue
        }
        
        // Parse the job description to extract name and description
        const parsedJob = parseJobDescription(jobDetails.description)
        
        const job: WalletJob = {
          id: jobId,
          name: parsedJob.name,
          status: getJobStatusString(jobDetails.status),
          timestamp: formatTimestamp(event.timestampMs || undefined),
          rewardAmount: jobDetails?.rewardAmount || undefined,
          description: parsedJob.description,
          worker: jobDetails?.worker || undefined,
          result: jobDetails?.result || undefined,
          createdAt: jobTimestamps?.createdAt || undefined,
          claimedAt: jobTimestamps?.claimedAt || undefined,
          completedAt: jobTimestamps?.completedAt || undefined,
          eventId: event.id.eventSeq || undefined,
          transactionDigest: event.id.txDigest
        }
        
        jobs.push(job)
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error)
        // Add basic job info even if details fail
        jobs.push({
          id: jobId,
          name: `Job ${jobId.slice(-8)}`,
          status: 'Error',
          timestamp: formatTimestamp(event.timestampMs || undefined),
          description: 'Failed to load job details',
          eventId: event.id.eventSeq || undefined,
          transactionDigest: event.id.txDigest
        })
      }
    }

    return jobs
  } catch (error) {
    console.error('Error fetching wallet jobs:', error)
    return []
  }
}

// Function to refresh job status (useful for polling)
export async function refreshJobStatus(job: WalletJob): Promise<WalletJob> {
  try {
    const jobDetails = await getJobDetails(job.id)
    const jobTimestamps = await getJobTimestamps(job.id)
    
    return {
      ...job,
      status: jobDetails ? getJobStatusString(jobDetails.status) : job.status,
      rewardAmount: jobDetails?.rewardAmount ?? job.rewardAmount,
      worker: jobDetails?.worker ?? job.worker,
      result: jobDetails?.result ?? job.result,
      claimedAt: jobTimestamps?.claimedAt ?? job.claimedAt,
      completedAt: jobTimestamps?.completedAt ?? job.completedAt
    }
  } catch (error) {
    console.error(`Error refreshing job ${job.id}:`, error)
    return job
  }
}
