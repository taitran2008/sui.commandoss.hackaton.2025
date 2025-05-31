'use client'

import { useState, useEffect } from 'react'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { 
  CONTRACT_CONFIG, 
  JOB_STATUS_LABELS, 
  JOB_STATUS, 
  COMMON_QUEUES,
  REFRESH_INTERVAL 
} from '../constants/contract'
import { JobQueueService } from '../utils/jobQueueService'
import type { Job, QueueStats } from '../types'

export function JobMonitor() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  
  const [jobs, setJobs] = useState<Job[]>([])
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [treasuryBalance, setTreasuryBalance] = useState<string>('0')
  const [searchJobId, setSearchJobId] = useState('')
  const [selectedQueue, setSelectedQueue] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const jobService = account ? new JobQueueService(suiClient, account.address) : null

  const fetchJobDetails = async (jobId: string) => {
    if (!jobId.trim() || !jobService) return null
    
    try {
      const result = await jobService.getJobDetails(jobId)
      return result.success ? result.data : null
    } catch (error) {
      console.error('Error fetching job details:', error)
      return null
    }
  }

  const fetchQueueStats = async (queueName: string) => {
    if (!jobService) return { total_jobs: 0, pending_jobs: 0 }
    
    try {
      const result = await jobService.getQueueStats(queueName)
      return result.success ? result.data! : { total_jobs: 0, pending_jobs: 0 }
    } catch (error) {
      console.error('Error fetching queue stats:', error)
      return { total_jobs: 0, pending_jobs: 0 }
    }
  }

  const fetchTreasuryBalance = async () => {
    if (!jobService) return

    try {
      console.log('Fetching treasury balance...')
      const result = await jobService.getTreasuryBalance()
      console.log('Treasury balance result:', result)
      
      if (result.success && result.data) {
        setTreasuryBalance(result.data.balance)
        console.log('Set treasury balance to:', result.data.balance)
      } else {
        console.warn('Treasury balance fetch failed:', result.error)
      }
    } catch (error) {
      console.error('Error fetching treasury balance:', error)
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
      const jobData = await fetchJobDetails(searchJobId)
      
      if (jobData) {
        setJobs(prev => {
          const exists = prev.some(job => job.uuid === searchJobId)
          if (!exists) {
            return [jobData, ...prev]
          }
          return prev.map(job => job.uuid === searchJobId ? jobData : job)
        })
        setError(null)
      } else {
        setError(`Job "${searchJobId}" not found`)
      }
    } catch (error: any) {
      setError(`Error searching for job: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshQueueStats = async () => {
    setIsRefreshing(true)
    const stats: Record<string, QueueStats> = {}
    
    for (const queue of COMMON_QUEUES) {
      stats[queue] = await fetchQueueStats(queue)
    }
    
    setQueueStats(stats)
    await fetchTreasuryBalance()
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }

  const refreshJobDetails = async () => {
    if (jobs.length === 0) return

    setIsRefreshing(true)
    const updatedJobs = await Promise.all(
      jobs.map(async (job) => {
        const updated = await fetchJobDetails(job.uuid)
        return updated || job
      })
    )
    setJobs(updatedJobs)
    setIsRefreshing(false)
  }

  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.uuid !== jobId))
  }

  const filteredJobs = selectedQueue === 'all' 
    ? jobs 
    : jobs.filter(job => job.queue === selectedQueue)

  useEffect(() => {
    if (account) {
      refreshQueueStats()
      // Set up auto-refresh every 15 seconds
      const interval = setInterval(() => {
        refreshQueueStats()
        refreshJobDetails()
      }, REFRESH_INTERVAL)
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

  const formatSui = (mistAmount: string) => {
    return (parseInt(mistAmount) / 1e9).toFixed(4)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleString()
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
        <div className="monitor-header">
          <h3>Job Monitor</h3>
          <div className="monitor-actions">
            {lastRefresh && (
              <span className="last-refresh">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button 
              onClick={refreshQueueStats} 
              disabled={isRefreshing}
              className="refresh-btn"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
        </div>

        {/* Treasury Balance */}
        <div className="treasury-section">
          <h4>Treasury Balance</h4>
          <div className="treasury-info">
            <span className="treasury-amount">{formatSui(treasuryBalance)} SUI</span>
            <small>Total funds held in contract</small>
            {treasuryBalance === '125500000000' && (
              <small className="dev-mode-indicator">🧪 Mock data (dev mode)</small>
            )}
          </div>
        </div>

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
          <div className="jobs-header">
            <h4>Tracked Jobs ({filteredJobs.length})</h4>
            <div className="job-filters">
              <select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="queue-filter"
              >
                <option value="all">All Queues</option>
                {COMMON_QUEUES.map(queue => (
                  <option key={queue} value={queue}>{queue}</option>
                ))}
              </select>
              {jobs.length > 0 && (
                <button 
                  onClick={refreshJobDetails}
                  disabled={isRefreshing}
                  className="refresh-jobs-btn"
                >
                  {isRefreshing ? 'Updating...' : 'Update Jobs'}
                </button>
              )}
            </div>
          </div>
          
          {filteredJobs.length === 0 ? (
            <p className="no-jobs">
              {jobs.length === 0 
                ? 'No jobs tracked yet. Search for a job to start monitoring.' 
                : 'No jobs match the selected filter.'}
            </p>
          ) : (
            <div className="jobs-list">
              {filteredJobs.map((job) => (
                <div key={job.uuid} className="job-card">
                  <div className="job-header">
                    <div className="job-id-section">
                      <span className="job-id">{job.uuid}</span>
                      <button 
                        onClick={() => removeJob(job.uuid)}
                        className="remove-job-btn"
                        title="Remove from tracking"
                      >
                        ✕
                      </button>
                    </div>
                    <span 
                      className="job-status"
                      style={{ 
                        backgroundColor: getStatusColor(job.status),
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}
                    >
                      {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="job-details">
                    <div className="job-row">
                      <span className="label">Queue:</span>
                      <span className="queue-badge">{job.queue}</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Attempts:</span>
                      <span>{job.attempts}/3</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Stake:</span>
                      <span className="stake-amount">{formatSui(job.priority_stake)} SUI</span>
                    </div>
                    <div className="job-row">
                      <span className="label">Created:</span>
                      <span>{formatTimestamp(job.created_at)}</span>
                    </div>
                    {job.reserved_at && (
                      <div className="job-row">
                        <span className="label">Reserved:</span>
                        <span>{formatTimestamp(job.reserved_at)}</span>
                      </div>
                    )}
                    {job.error_message && (
                      <div className="job-row">
                        <span className="label">Error:</span>
                        <span className="error-text">{job.error_message}</span>
                      </div>
                    )}
                  </div>
                  
                  <details className="job-payload">
                    <summary>View Payload</summary>
                    <pre className="payload-content">{job.payload}</pre>
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
