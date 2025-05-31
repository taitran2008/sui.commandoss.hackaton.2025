'use client'

import { useState } from 'react'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { JobQueueService, formatUtils } from '../utils/jobQueueService'
import { 
  COMMON_QUEUES, 
  WORKER_CONFIG,
  SUISCAN_BASE_URL,
  DEFAULT_STAKE_AMOUNT,
  CONTRACT_CONFIG
} from '../constants/contract'
import type { Job, QueueStats, TreasuryInfo } from '../types'

export function ApiTester() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  // Form states
  const [jobForm, setJobForm] = useState({
    jobId: '',
    queue: 'image-processing',
    payload: '{"action": "resize", "image_url": "https://example.com/test.jpg"}',
    stakeAmount: '1'
  })
  
  const [workerForm, setWorkerForm] = useState({
    queues: ['image-processing'],
    batchSize: 10,
    visibilityTimeout: 300
  })
  
  const [lookupForm, setLookupForm] = useState({
    jobUuid: '',
    queueName: 'image-processing'
  })
  
  const [adminForm, setAdminForm] = useState({
    jobUuid: '',
    reason: 'Emergency refund'
  })
  
  // States for results and operations
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string>('')
  
  const jobService = new JobQueueService(suiClient, account?.address || '0x0')
  
  const setLoadingState = (operation: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }))
  }
  
  const setResult = (operation: string, result: any) => {
    setResults(prev => ({ ...prev, [operation]: result }))
  }

  // 1. Submit Job API
  const handleSubmitJob = async () => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }
    
    setLoadingState('submitJob', true)
    setError(null)
    
    try {
      const jobId = jobForm.jobId || formatUtils.generateJobId()
      const stakeAmountInMist = formatUtils.suiToMist(jobForm.stakeAmount)
      
      const txb = jobService.createSubmitJobTransaction(
        jobId,
        jobForm.queue,
        jobForm.payload,
        stakeAmountInMist
      )
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Job submitted successfully:', result)
            setResult('submitJob', {
              success: true,
              jobId,
              transactionDigest: result.digest,
              details: result
            })
            // Update form with the used job ID
            setJobForm(prev => ({ ...prev, jobId }))
          },
          onError: (error: any) => {
            console.error('Failed to submit job:', error)
            setResult('submitJob', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('submitJob', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('submitJob', false)
    }
  }

  // 2. Register Worker API
  const handleRegisterWorker = async () => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }
    
    setLoadingState('registerWorker', true)
    setError(null)
    
    try {
      const txb = jobService.createRegisterWorkerTransaction(
        workerForm.queues,
        workerForm.batchSize,
        workerForm.visibilityTimeout
      )
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Worker registered successfully:', result)
            const newSubscriptionId = jobService.parseSubscriptionIdFromResult(result) || `worker_${Date.now()}`
            setSubscriptionId(newSubscriptionId)
            setResult('registerWorker', {
              success: true,
              subscriptionId: newSubscriptionId,
              transactionDigest: result.digest,
              details: result
            })
          },
          onError: (error: any) => {
            console.error('Failed to register worker:', error)
            setResult('registerWorker', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('registerWorker', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('registerWorker', false)
    }
  }

  // 3. Fetch Jobs API
  const handleFetchJobs = async () => {
    if (!account || !subscriptionId) {
      setError('Please register as a worker first')
      return
    }
    
    setLoadingState('fetchJobs', true)
    setError(null)
    
    try {
      const txb = jobService.createFetchJobsTransaction(subscriptionId, lookupForm.queueName)
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Jobs fetched successfully:', result)
            const jobUuids = jobService.parseJobUuidsFromResult(result)
            setResult('fetchJobs', {
              success: true,
              jobUuids,
              count: jobUuids.length,
              transactionDigest: result.digest,
              details: result
            })
          },
          onError: (error: any) => {
            console.error('Failed to fetch jobs:', error)
            setResult('fetchJobs', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('fetchJobs', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('fetchJobs', false)
    }
  }

  // 4. Complete Job API
  const handleCompleteJob = async () => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }
    
    setLoadingState('completeJob', true)
    setError(null)
    
    try {
      const txb = jobService.createCompleteJobTransaction(lookupForm.jobUuid)
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Job completed successfully:', result)
            setResult('completeJob', {
              success: true,
              jobUuid: lookupForm.jobUuid,
              transactionDigest: result.digest,
              details: result
            })
          },
          onError: (error: any) => {
            console.error('Failed to complete job:', error)
            setResult('completeJob', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('completeJob', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('completeJob', false)
    }
  }

  // 5. Fail Job API
  const handleFailJob = async () => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }
    
    setLoadingState('failJob', true)
    setError(null)
    
    try {
      const txb = jobService.createFailJobTransaction(lookupForm.jobUuid, 'Test failure from API tester')
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Job failed successfully:', result)
            setResult('failJob', {
              success: true,
              jobUuid: lookupForm.jobUuid,
              transactionDigest: result.digest,
              details: result
            })
          },
          onError: (error: any) => {
            console.error('Failed to fail job:', error)
            setResult('failJob', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('failJob', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('failJob', false)
    }
  }

  // 6. Get Job Details API (View function)
  const handleGetJobDetails = async () => {
    setLoadingState('getJobDetails', true)
    setError(null)
    
    try {
      const result = await jobService.getJobDetails(lookupForm.jobUuid)
      setResult('getJobDetails', result)
    } catch (error: any) {
      setResult('getJobDetails', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('getJobDetails', false)
    }
  }

  // 7. Get Queue Stats API (View function)
  const handleGetQueueStats = async () => {
    setLoadingState('getQueueStats', true)
    setError(null)
    
    try {
      const result = await jobService.getQueueStats(lookupForm.queueName)
      setResult('getQueueStats', result)
    } catch (error: any) {
      setResult('getQueueStats', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('getQueueStats', false)
    }
  }

  // 8. Get Treasury Balance API (View function)
  const handleGetTreasuryBalance = async () => {
    setLoadingState('getTreasuryBalance', true)
    setError(null)
    
    try {
      const result = await jobService.getTreasuryBalance()
      setResult('getTreasuryBalance', result)
    } catch (error: any) {
      setResult('getTreasuryBalance', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('getTreasuryBalance', false)
    }
  }

  // 9. Admin Refund API
  const handleAdminRefund = async () => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }
    
    setLoadingState('adminRefund', true)
    setError(null)
    
    try {
      const txb = jobService.createAdminRefundTransaction(adminForm.jobUuid, adminForm.reason)
      
      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: (result: any) => {
            console.log('Admin refund successful:', result)
            setResult('adminRefund', {
              success: true,
              jobUuid: adminForm.jobUuid,
              reason: adminForm.reason,
              transactionDigest: result.digest,
              details: result
            })
          },
          onError: (error: any) => {
            console.error('Failed admin refund:', error)
            setResult('adminRefund', {
              success: false,
              error: jobService.parseContractError(error)
            })
          }
        }
      )
    } catch (error: any) {
      setResult('adminRefund', {
        success: false,
        error: error?.message || 'Unknown error occurred'
      })
    } finally {
      setLoadingState('adminRefund', false)
    }
  }

  const handleQueueToggle = (queue: string) => {
    setWorkerForm(prev => ({
      ...prev,
      queues: prev.queues.includes(queue)
        ? prev.queues.filter(q => q !== queue)
        : [...prev.queues, queue]
    }))
  }

  if (!account) {
    return (
      <div className="api-tester-wrapper">
        <div className="api-tester-card">
          <h3>API Tester</h3>
          <p>Connect your wallet to test all Job Queue Smart Contract APIs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="api-tester-wrapper">
      <div className="api-tester-card">
        <h3>Job Queue API Comprehensive Tester</h3>
        <p className="api-description">
          Test all APIs from the Smart Contract documentation. Results are displayed below each API section.
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* 1. Submit Job API */}
        <div className="api-section">
          <h4>1. Submit Job API</h4>
          <div className="api-form">
            <div className="form-row">
              <div className="form-group">
                <label>Job ID (optional)</label>
                <input
                  type="text"
                  value={jobForm.jobId}
                  onChange={(e) => setJobForm(prev => ({ ...prev, jobId: e.target.value }))}
                  placeholder="Leave empty for auto-generation"
                />
              </div>
              <div className="form-group">
                <label>Queue</label>
                <select
                  value={jobForm.queue}
                  onChange={(e) => setJobForm(prev => ({ ...prev, queue: e.target.value }))}
                >
                  {COMMON_QUEUES.map(queue => (
                    <option key={queue} value={queue}>{queue}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label>Payload (JSON)</label>
              <textarea
                value={jobForm.payload}
                onChange={(e) => setJobForm(prev => ({ ...prev, payload: e.target.value }))}
                rows={3}
                placeholder='{"action": "process", "data": "example"}'
              />
            </div>
            
            <div className="form-group">
              <label>Stake Amount (SUI)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={jobForm.stakeAmount}
                onChange={(e) => setJobForm(prev => ({ ...prev, stakeAmount: e.target.value }))}
              />
            </div>
            
            <button
              onClick={handleSubmitJob}
              disabled={loading.submitJob}
              className="api-btn primary"
            >
              {loading.submitJob ? 'Submitting...' : 'Submit Job'}
            </button>
          </div>
          
          {results.submitJob && (
            <div className={`api-result ${results.submitJob.success ? 'success' : 'error'}`}>
              <h5>Submit Job Result:</h5>
              <pre>{JSON.stringify(results.submitJob, null, 2)}</pre>
              {results.submitJob.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.submitJob.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
        </div>

        {/* 2. Register Worker API */}
        <div className="api-section">
          <h4>2. Register Worker API</h4>
          <div className="api-form">
            <div className="form-group">
              <label>Select Queues</label>
              <div className="queue-checkboxes">
                {COMMON_QUEUES.map(queue => (
                  <label key={queue} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={workerForm.queues.includes(queue)}
                      onChange={() => handleQueueToggle(queue)}
                    />
                    <span>{queue}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Batch Size</label>
                <input
                  type="number"
                  min={WORKER_CONFIG.MIN_BATCH_SIZE}
                  max={WORKER_CONFIG.MAX_BATCH_SIZE}
                  value={workerForm.batchSize}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Visibility Timeout (seconds)</label>
                <input
                  type="number"
                  min={WORKER_CONFIG.MIN_VISIBILITY_TIMEOUT}
                  max={WORKER_CONFIG.MAX_VISIBILITY_TIMEOUT}
                  value={workerForm.visibilityTimeout}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, visibilityTimeout: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            
            <button
              onClick={handleRegisterWorker}
              disabled={loading.registerWorker || !!subscriptionId}
              className="api-btn primary"
            >
              {loading.registerWorker ? 'Registering...' : subscriptionId ? 'Already Registered' : 'Register Worker'}
            </button>
          </div>
          
          {results.registerWorker && (
            <div className={`api-result ${results.registerWorker.success ? 'success' : 'error'}`}>
              <h5>Register Worker Result:</h5>
              <pre>{JSON.stringify(results.registerWorker, null, 2)}</pre>
              {results.registerWorker.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.registerWorker.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
          
          {subscriptionId && (
            <div className="subscription-display">
              <strong>Worker Subscription ID:</strong> {subscriptionId}
            </div>
          )}
        </div>

        {/* Lookup Forms Section */}
        <div className="api-section">
          <h4>Lookup Parameters</h4>
          <div className="api-form">
            <div className="form-row">
              <div className="form-group">
                <label>Job UUID (for job operations)</label>
                <input
                  type="text"
                  value={lookupForm.jobUuid}
                  onChange={(e) => setLookupForm(prev => ({ ...prev, jobUuid: e.target.value }))}
                  placeholder="Enter job UUID"
                />
              </div>
              <div className="form-group">
                <label>Queue Name (for queue operations)</label>
                <select
                  value={lookupForm.queueName}
                  onChange={(e) => setLookupForm(prev => ({ ...prev, queueName: e.target.value }))}
                >
                  {COMMON_QUEUES.map(queue => (
                    <option key={queue} value={queue}>{queue}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Fetch Jobs API */}
        <div className="api-section">
          <h4>3. Fetch Jobs API</h4>
          <button
            onClick={handleFetchJobs}
            disabled={loading.fetchJobs || !subscriptionId}
            className="api-btn primary"
          >
            {loading.fetchJobs ? 'Fetching...' : 'Fetch Jobs'}
          </button>
          
          {results.fetchJobs && (
            <div className={`api-result ${results.fetchJobs.success ? 'success' : 'error'}`}>
              <h5>Fetch Jobs Result:</h5>
              <pre>{JSON.stringify(results.fetchJobs, null, 2)}</pre>
              {results.fetchJobs.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.fetchJobs.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
        </div>

        {/* 4. Complete Job API */}
        <div className="api-section">
          <h4>4. Complete Job API</h4>
          <button
            onClick={handleCompleteJob}
            disabled={loading.completeJob || !lookupForm.jobUuid}
            className="api-btn primary"
          >
            {loading.completeJob ? 'Completing...' : 'Complete Job'}
          </button>
          
          {results.completeJob && (
            <div className={`api-result ${results.completeJob.success ? 'success' : 'error'}`}>
              <h5>Complete Job Result:</h5>
              <pre>{JSON.stringify(results.completeJob, null, 2)}</pre>
              {results.completeJob.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.completeJob.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
        </div>

        {/* 5. Fail Job API */}
        <div className="api-section">
          <h4>5. Fail Job API</h4>
          <button
            onClick={handleFailJob}
            disabled={loading.failJob || !lookupForm.jobUuid}
            className="api-btn secondary"
          >
            {loading.failJob ? 'Failing...' : 'Fail Job'}
          </button>
          
          {results.failJob && (
            <div className={`api-result ${results.failJob.success ? 'success' : 'error'}`}>
              <h5>Fail Job Result:</h5>
              <pre>{JSON.stringify(results.failJob, null, 2)}</pre>
              {results.failJob.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.failJob.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
        </div>

        {/* View Functions Section */}
        <div className="api-section view-functions">
          <h4>View Functions (Read-Only)</h4>
          
          {/* 6. Get Job Details */}
          <div className="view-function">
            <h5>6. Get Job Details</h5>
            <button
              onClick={handleGetJobDetails}
              disabled={loading.getJobDetails || !lookupForm.jobUuid}
              className="api-btn info"
            >
              {loading.getJobDetails ? 'Loading...' : 'Get Job Details'}
            </button>
            
            {results.getJobDetails && (
              <div className={`api-result ${results.getJobDetails.success ? 'success' : 'error'}`}>
                <h6>Job Details Result:</h6>
                <pre>{JSON.stringify(results.getJobDetails, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* 7. Get Queue Stats */}
          <div className="view-function">
            <h5>7. Get Queue Statistics</h5>
            <button
              onClick={handleGetQueueStats}
              disabled={loading.getQueueStats}
              className="api-btn info"
            >
              {loading.getQueueStats ? 'Loading...' : 'Get Queue Stats'}
            </button>
            
            {results.getQueueStats && (
              <div className={`api-result ${results.getQueueStats.success ? 'success' : 'error'}`}>
                <h6>Queue Stats Result:</h6>
                <pre>{JSON.stringify(results.getQueueStats, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* 8. Get Treasury Balance */}
          <div className="view-function">
            <h5>8. Get Treasury Balance</h5>
            <button
              onClick={handleGetTreasuryBalance}
              disabled={loading.getTreasuryBalance}
              className="api-btn info"
            >
              {loading.getTreasuryBalance ? 'Loading...' : 'Get Treasury Balance'}
            </button>
            
            {results.getTreasuryBalance && (
              <div className={`api-result ${results.getTreasuryBalance.success ? 'success' : 'error'}`}>
                <h6>Treasury Balance Result:</h6>
                <pre>{JSON.stringify(results.getTreasuryBalance, null, 2)}</pre>
                {results.getTreasuryBalance.success && results.getTreasuryBalance.data && (
                  <div className="balance-display">
                    <strong>Treasury Balance:</strong> {formatUtils.formatSui(results.getTreasuryBalance.data.balance)} SUI
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Admin Functions */}
        <div className="api-section admin-functions">
          <h4>9. Admin Functions</h4>
          <div className="api-form">
            <div className="form-row">
              <div className="form-group">
                <label>Job UUID to Refund</label>
                <input
                  type="text"
                  value={adminForm.jobUuid}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, jobUuid: e.target.value }))}
                  placeholder="Enter job UUID for refund"
                />
              </div>
              <div className="form-group">
                <label>Refund Reason</label>
                <input
                  type="text"
                  value={adminForm.reason}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Emergency refund reason"
                />
              </div>
            </div>
            
            <button
              onClick={handleAdminRefund}
              disabled={loading.adminRefund || !adminForm.jobUuid}
              className="api-btn warning"
            >
              {loading.adminRefund ? 'Processing...' : 'Admin Refund'}
            </button>
          </div>
          
          {results.adminRefund && (
            <div className={`api-result ${results.adminRefund.success ? 'success' : 'error'}`}>
              <h5>Admin Refund Result:</h5>
              <pre>{JSON.stringify(results.adminRefund, null, 2)}</pre>
              {results.adminRefund.transactionDigest && (
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${results.adminRefund.transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Testing Instructions */}
        <div className="api-section instructions">
          <h4>Testing Instructions</h4>
          <div className="instruction-content">
            <ol>
              <li><strong>Submit Job:</strong> Create a new job with payload and stake</li>
              <li><strong>Register Worker:</strong> Register to process jobs from queues</li>
              <li><strong>Fetch Jobs:</strong> Get available jobs from a queue (requires worker registration)</li>
              <li><strong>Complete/Fail Job:</strong> Mark jobs as completed or failed (requires job UUID)</li>
              <li><strong>View Functions:</strong> Query job details, queue stats, and treasury balance</li>
              <li><strong>Admin Functions:</strong> Refund jobs (admin privileges required)</li>
            </ol>
            
            <div className="contract-info">
              <h5>Contract Information:</h5>
              <ul>
                <li><strong>Package ID:</strong> {CONTRACT_CONFIG.PACKAGE_ID}</li>
                <li><strong>Manager Object:</strong> {CONTRACT_CONFIG.MANAGER_OBJECT_ID}</li>
                <li><strong>Network:</strong> Sui Testnet</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
