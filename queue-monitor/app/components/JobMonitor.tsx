'use client'

import { useState, useEffect } from 'react'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONTRACT_CONFIG, JOB_STATUS_LABELS, JOB_STATUS } from '../constants/contract'

interface Job {
  uuid: string
  queue: string
  payload: string
  attempts: number
  status: number
  submitter: string
  priority_stake: string
  created_at: string
  available_at: string
  reserved_at?: string
  error_message?: string
}

interface QueueStats {
  total_jobs: number
  pending_jobs: number
}

export function JobMonitor() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  
  const [jobs, setJobs] = useState<Job[]>([])
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [searchJobId, setSearchJobId] = useState('')
  const [selectedQueue, setSelectedQueue] = useState('image-processing')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobDetails = async (jobId: string) => {
    if (!jobId.trim()) return null
    
    try {
      const txb = new Transaction()
      txb.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::get_job`,
        arguments: [
          txb.object(CONTRACT_CONFIG.MANAGER_OBJECT_ID),
          txb.pure.string(jobId)
        ]
      })

      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: account?.address || '0x0'
      })
      
      // Parse the result to extract job details
      // Note: This is a simplified parsing - you may need to adjust based on the actual response format
      if (result.results?.[0]?.returnValues) {
        const jobData = result.results[0].returnValues[0]
        return jobData
      }
      
      return null
    } catch (error) {
      console.error('Error fetching job details:', error)
      return null
    }
  }

  const fetchQueueStats = async (queueName: string) => {
    try {
      const txb = new Transaction()
      txb.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::get_queue_stats`,
        arguments: [
          txb.object(CONTRACT_CONFIG.MANAGER_OBJECT_ID),
          txb.pure.string(queueName)
        ]
      })

      const result = await suiClient.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: account?.address || '0x0'
      })
      
      // Parse queue statistics
      if (result.results?.[0]?.returnValues) {
        const [totalJobs, pendingJobs] = result.results[0].returnValues
        return {
          total_jobs: parseInt(String(totalJobs?.[0] || '0')),
          pending_jobs: parseInt(String(pendingJobs?.[0] || '0'))
        }
      }
      
      return { total_jobs: 0, pending_jobs: 0 }
    } catch (error) {
      console.error('Error fetching queue stats:', error)
      return { total_jobs: 0, pending_jobs: 0 }
    }
  }

  const handleSearchJob = async () => {
    if (!searchJobId.trim()) {
      setError('Please enter a job ID')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // For now, we'll add a placeholder job for demonstration
      // In a real implementation, you'd parse the actual response from the smart contract
      const mockJob: Job = {
        uuid: searchJobId,
        queue: 'image-processing',
        payload: '{"action": "process", "data": "example"}',
        attempts: 1,
        status: JOB_STATUS.PENDING,
        submitter: account?.address || '',
        priority_stake: '1000000000',
        created_at: Date.now().toString(),
        available_at: Date.now().toString()
      }

      setJobs(prev => {
        const exists = prev.some(job => job.uuid === searchJobId)
        if (!exists) {
          return [mockJob, ...prev]
        }
        return prev.map(job => job.uuid === searchJobId ? mockJob : job)
      })
      
      setError('Note: This is mock data. Real job fetching will be implemented when the smart contract response format is confirmed.')
    } catch (error: any) {
      setError(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshQueueStats = async () => {
    const queues = ['image-processing', 'data-analysis', 'email-notifications', 'file-conversion', 'backup-tasks']
    const stats: Record<string, QueueStats> = {}
    
    for (const queue of queues) {
      stats[queue] = await fetchQueueStats(queue)
    }
    
    setQueueStats(stats)
  }

  useEffect(() => {
    if (account) {
      refreshQueueStats()
      // Set up auto-refresh every 15 seconds
      const interval = setInterval(refreshQueueStats, 15000)
      return () => clearInterval(interval)
    }
  }, [account])

  const getStatusColor = (status: number) => {
    switch (status) {
      case JOB_STATUS.PENDING: return '#f59e0b'
      case JOB_STATUS.RESERVED: return '#3b82f6'
      case JOB_STATUS.COMPLETED: return '#10b981'
      case JOB_STATUS.CANCELLED: return '#6b7280'
      case JOB_STATUS.DLQ: return '#ef4444'
      default: return '#6b7280'
    }
  }

  if (!account) {
    return (
      <div className="job-monitor-wrapper">
        <div className="job-monitor-card">
          <h3>Job Monitor</h3>
          <p>Connect your wallet to monitor jobs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="job-monitor-wrapper">
      <div className="job-monitor-card">
        <h3>Job Monitor</h3>

        {/* Queue Statistics */}
        <div className="queue-stats-section">
          <h4>Queue Statistics</h4>
          <div className="stats-grid">
            {Object.entries(queueStats).map(([queue, stats]) => (
              <div key={queue} className="stat-card">
                <div className="stat-queue">{queue}</div>
                <div className="stat-numbers">
                  <span className="stat-total">Total: {stats.total_jobs}</span>
                  <span className="stat-pending">Pending: {stats.pending_jobs}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={refreshQueueStats} className="refresh-stats-btn">
            Refresh Stats
          </button>
        </div>

        {/* Job Search */}
        <div className="job-search-section">
          <h4>Search Job</h4>
          <div className="search-form">
            <input
              type="text"
              value={searchJobId}
              onChange={(e) => setSearchJobId(e.target.value)}
              placeholder="Enter job ID to search"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchJob()}
            />
            <button 
              onClick={handleSearchJob}
              disabled={isLoading}
              className="search-btn"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Jobs List */}
        <div className="jobs-section">
          <h4>Tracked Jobs</h4>
          {jobs.length === 0 ? (
            <p className="no-jobs">No jobs tracked yet. Search for a job to start monitoring.</p>
          ) : (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div key={job.uuid} className="job-card">
                  <div className="job-header">
                    <span className="job-id">{job.uuid}</span>
                    <span 
                      className="job-status"
                      style={{ 
                        backgroundColor: getStatusColor(job.status),
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}
                    >
                      {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="job-details">
                    <div className="job-row">
                      <span className="label">Queue:</span>
                      <span>{job.queue}</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Attempts:</span>
                      <span>{job.attempts}</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Stake:</span>
                      <span>{(parseInt(job.priority_stake) / 1e9).toFixed(4)} SUI</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Created:</span>
                      <span>{new Date(parseInt(job.created_at)).toLocaleString()}</span>
                    </div>
                    {job.error_message && (
                      <div className="job-row">
                        <span className="label">Error:</span>
                        <span className="error-text">{job.error_message}</span>
                      </div>
                    )}
                  </div>
                  
                  <details className="job-payload">
                    <summary>View Payload</summary>
                    <pre>{job.payload}</pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
