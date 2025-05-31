# SUI Job Queue Monitor

A web application for interacting with the decentralized job queue smart contract on SUI Testnet.

## Features

✅ **Wallet Integration**
- Connect to SUI Testnet wallets
- Display SUI balance with auto-refresh
- Support for multiple wallet providers

✅ **Job Submission**
- Submit jobs to different queues (image-processing, data-analysis, etc.)
- Configurable stake amounts for job priority
- JSON payload support with validation
- Auto-generated unique job IDs

✅ **Job Monitoring**
- Search for specific jobs by ID
- View job status and details
- Track queue statistics across all queues
- Real-time status updates

## Smart Contract Integration

**Network**: SUI Testnet
**Package ID**: `0x4bb63db22d3178013ba93be9d527a72e5511b7a90f031ea9a5f655533e5ecf6d`
**Manager Object**: `0x7d7435df26bc477790d1c50fb679408c9ee61282369507ff3295626bb06037bc`

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Connect Wallet**
   - Open http://localhost:3000
   - Click "Connect" to connect your SUI wallet
   - Make sure you're on SUI Testnet

4. **Submit a Job**
   - Fill in the job submission form
   - Choose a queue (e.g., image-processing)
   - Add your job payload in JSON format
   - Set stake amount (minimum 0.1 SUI)
   - Click "Submit Job"

5. **Monitor Jobs**
   - Use the job search to find specific jobs
   - View queue statistics to see overall activity
   - Track job status changes

## Available Queues

- `image-processing` - For image manipulation tasks
- `data-analysis` - For data processing jobs
- `email-notifications` - For sending notifications
- `file-conversion` - For file format conversions
- `backup-tasks` - For backup operations

## Job Statuses

- **Pending** (0) - Job waiting to be processed
- **Processing** (1) - Job currently being worked on
- **Completed** (2) - Job finished successfully
- **Cancelled** (3) - Job was cancelled
- **Failed (DLQ)** (4) - Job failed after max retries

## Payment System

- **Stake Required**: Jobs require SUI tokens as stake
- **Priority**: Higher stakes get processed first
- **Payment**: Stake is kept when job completes successfully
- **Refund**: Stake returned for failed/cancelled jobs

## Technical Details

- **Framework**: Next.js 15 with TypeScript
- **SUI SDK**: @mysten/dapp-kit for wallet integration
- **Styling**: Custom CSS with responsive design
- **Smart Contract**: Move language on SUI blockchain

## API Integration

The app integrates with the job queue smart contract using these main functions:

- `submit_job` - Submit new jobs with stake
- `get_job` - Retrieve job details
- `get_queue_stats` - Get queue statistics
- `register_worker` - Register as a job processor
- `fetch_jobs` - Get jobs for processing
- `complete_job` - Mark jobs as completed
- `fail_job` - Mark jobs as failed

## Development Notes

- Job fetching currently shows mock data for demonstration
- Real job parsing will be implemented once smart contract response format is confirmed
- Queue statistics use simplified parsing
- Error handling includes user-friendly messages

## Next Steps

1. Implement proper job data parsing from smart contract responses
2. Add worker registration functionality
3. Implement job processing interface
4. Add real-time event listening for job status updates
5. Add job history and analytics dashboard
