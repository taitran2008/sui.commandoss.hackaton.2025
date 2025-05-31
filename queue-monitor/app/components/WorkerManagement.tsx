'use client'

import { useState } from 'react'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { 
  COMMON_QUEUES, 
  WORKER_CONFIG,
  CONTRACT_CONFIG,
  SUISCAN_BASE_URL 
} from '../constants/contract'
import { JobQueueService } from '../utils/jobQueueService'
import type { WorkerRegistrationForm } from '../types'

interface WorkerManagementProps {
  onWorkerRegistered?: (subscriptionId: string) => void
}

export function WorkerManagement({ onWorkerRegistered }: WorkerManagementProps) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [isRegistering, setIsRegistering] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [formData, setFormData] = useState<WorkerRegistrationForm>({
    queues: ['image-processing'],
    batchSize: WORKER_CONFIG.DEFAULT_BATCH_SIZE,
    visibilityTimeout: WORKER_CONFIG.DEFAULT_VISIBILITY_TIMEOUT
  })
  const [subscriptionId, setSubscriptionId] = useState('')
  const [selectedQueue, setSelectedQueue] = useState('image-processing')
  const [fetchedJobs, setFetchedJobs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null)

  const validateForm = () => {
    if (formData.queues.length === 0) {
      return 'Please select at least one queue'
    }
    if (formData.batchSize < WORKER_CONFIG.MIN_BATCH_SIZE || formData.batchSize > WORKER_CONFIG.MAX_BATCH_SIZE) {
      return `Batch size must be between ${WORKER_CONFIG.MIN_BATCH_SIZE} and ${WORKER_CONFIG.MAX_BATCH_SIZE}`
    }
    if (formData.visibilityTimeout < WORKER_CONFIG.MIN_VISIBILITY_TIMEOUT || formData.visibilityTimeout > WORKER_CONFIG.MAX_VISIBILITY_TIMEOUT) {
      return `Visibility timeout must be between ${WORKER_CONFIG.MIN_VISIBILITY_TIMEOUT} and ${WORKER_CONFIG.MAX_VISIBILITY_TIMEOUT} seconds`
    }
    return null
  }

  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!account) {
      setError('Please connect your wallet first')
      return
    }

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsRegistering(true)
    setError(null)
    setSuccess(null)
    setTransactionDigest(null)

    try {
      const jobService = new JobQueueService(suiClient, account.address)
      
      const txb = jobService.createRegisterWorkerTransaction(
        formData.queues,
        formData.batchSize,
        formData.visibilityTimeout
      )

      signAndExecuteTransaction(
        {
          transaction: txb
        },
        {
          onSuccess: (result: any) => {
            console.log('Worker registered successfully:', result)
            const txDigest = result.digest
            setTransactionDigest(txDigest)
            
            // Extract subscription ID from the result
            const newSubscriptionId = jobService.parseSubscriptionIdFromResult(result)
            if (newSubscriptionId) {
              setSubscriptionId(newSubscriptionId)
            } else {
              // Fallback for development
              setSubscriptionId(`worker_subscription_${Date.now()}`)
            }
            
            setSuccess('Worker registered successfully! You can now fetch jobs from the selected queues.')
            onWorkerRegistered?.(newSubscriptionId)
          },
          onError: (error: any) => {
            console.error('Failed to register worker:', error)
            const errorMessage = jobService.parseContractError(error)
            setError(`Failed to register worker: ${errorMessage}`)
          }
        }
      )
    } catch (error: any) {
      console.error('Error registering worker:', error)
      setError(`Error: ${error?.message || 'Unknown error occurred'}`)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleFetchJobs = async () => {
    if (!subscriptionId || !selectedQueue) {
      setError('Please register as a worker first and select a queue')
      return
    }

    setIsFetching(true)
    setError(null)
    setFetchedJobs([])

    try {
      const jobService = new JobQueueService(suiClient, account?.address || '0x0')
      
      const txb = jobService.createFetchJobsTransaction(subscriptionId, selectedQueue)

      signAndExecuteTransaction(
        {
          transaction: txb
        },
        {
          onSuccess: (result: any) => {
            console.log('Jobs fetched successfully:', result)
            
            // Parse job UUIDs from the result
            const jobUuids = jobService.parseJobUuidsFromResult(result)
            setFetchedJobs(jobUuids)
            
            if (jobUuids.length > 0) {
              setSuccess(`Fetched ${jobUuids.length} job(s) from queue "${selectedQueue}"`)
            } else {
              setSuccess(`No jobs available in queue "${selectedQueue}"`)
            }
          },
          onError: (error: any) => {
            console.error('Failed to fetch jobs:', error)
            const errorMessage = jobService.parseContractError(error)
            setError(`Failed to fetch jobs: ${errorMessage}`)
          }
        }
      )
    } catch (error: any) {
      console.error('Error fetching jobs:', error)
      setError(`Error: ${error?.message || 'Unknown error occurred'}`)
    } finally {
      setIsFetching(false)
    }
  }

  const handleCompleteJob = async (jobUuid: string) => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }

    try {
      const jobService = new JobQueueService(suiClient, account.address)
      const txb = jobService.createCompleteJobTransaction(jobUuid)

      signAndExecuteTransaction(
        {
          transaction: txb
        },
        {
          onSuccess: (result: any) => {
            console.log('Job completed successfully:', result)
            setFetchedJobs(prev => prev.filter(id => id !== jobUuid))
            setSuccess(`Job "${jobUuid}" marked as completed`)
          },
          onError: (error: any) => {
            console.error('Failed to complete job:', error)
            const errorMessage = jobService.parseContractError(error)
            setError(`Failed to complete job: ${errorMessage}`)
          }
        }
      )
    } catch (error: any) {
      console.error('Error completing job:', error)
      setError(`Error: ${error?.message || 'Unknown error occurred'}`)
    }
  }

  const handleFailJob = async (jobUuid: string, errorMessage: string) => {
    if (!account) {
      setError('Please connect your wallet first')
      return
    }

    try {
      const jobService = new JobQueueService(suiClient, account.address)
      const txb = jobService.createFailJobTransaction(jobUuid, errorMessage)

      signAndExecuteTransaction(
        {
          transaction: txb
        },
        {
          onSuccess: (result: any) => {
            console.log('Job failed successfully:', result)
            setFetchedJobs(prev => prev.filter(id => id !== jobUuid))
            setSuccess(`Job "${jobUuid}" marked as failed`)
          },
          onError: (error: any) => {
            console.error('Failed to fail job:', error)
            const errorMessage = jobService.parseContractError(error)
            setError(`Failed to mark job as failed: ${errorMessage}`)
          }
        }
      )
    } catch (error: any) {
      console.error('Error failing job:', error)
      setError(`Error: ${error?.message || 'Unknown error occurred'}`)
    }
  }

  const handleQueueToggle = (queue: string) => {
    setFormData(prev => ({
      ...prev,
      queues: prev.queues.includes(queue)
        ? prev.queues.filter(q => q !== queue)
        : [...prev.queues, queue]
    }))
  }

  if (!account) {
    return (
      <div className="worker-management-wrapper">
        <div className="worker-management-card">
          <h3>Worker Management</h3>
          <p>Connect your wallet to register as a worker and process jobs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="worker-management-wrapper">
      <div className="worker-management-card">
        <h3>Worker Management</h3>

        {/* Worker Registration Form */}
        <div className="worker-registration-section">
          <h4>Register as Worker</h4>
          <form onSubmit={handleRegisterWorker} className="worker-form">
            <div className="form-group">
              <label>Select Queues to Subscribe *</label>
              <div className="queue-checkboxes">
                {COMMON_QUEUES.map(queue => (
                  <label key={queue} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.queues.includes(queue)}
                      onChange={() => handleQueueToggle(queue)}
                    />
                    <span>{queue}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="batchSize">Batch Size *</label>
                <input
                  id="batchSize"
                  type="number"
                  min={WORKER_CONFIG.MIN_BATCH_SIZE}
                  max={WORKER_CONFIG.MAX_BATCH_SIZE}
                  value={formData.batchSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                  required
                />
                <small>Max jobs to fetch at once ({WORKER_CONFIG.MIN_BATCH_SIZE}-{WORKER_CONFIG.MAX_BATCH_SIZE})</small>
              </div>

              <div className="form-group">
                <label htmlFor="visibilityTimeout">Visibility Timeout (seconds) *</label>
                <input
                  id="visibilityTimeout"
                  type="number"
                  min={WORKER_CONFIG.MIN_VISIBILITY_TIMEOUT}
                  max={WORKER_CONFIG.MAX_VISIBILITY_TIMEOUT}
                  value={formData.visibilityTimeout}
                  onChange={(e) => setFormData(prev => ({ ...prev, visibilityTimeout: parseInt(e.target.value) }))}
                  required
                />
                <small>Time to reserve jobs ({WORKER_CONFIG.MIN_VISIBILITY_TIMEOUT}-{WORKER_CONFIG.MAX_VISIBILITY_TIMEOUT}s)</small>
              </div>
            </div>

            <button
              type="submit"
              disabled={isRegistering || !!subscriptionId}
              className="register-btn"
            >
              {isRegistering ? 'Registering...' : subscriptionId ? 'Already Registered' : 'Register Worker'}
            </button>
          </form>
        </div>

        {/* Job Fetching Section */}
        {subscriptionId && (
          <div className="job-fetching-section">
            <h4>Fetch Jobs</h4>
            <div className="fetch-form">
              <div className="form-group">
                <label htmlFor="fetchQueue">Select Queue</label>
                <select
                  id="fetchQueue"
                  value={selectedQueue}
                  onChange={(e) => setSelectedQueue(e.target.value)}
                >
                  {formData.queues.map(queue => (
                    <option key={queue} value={queue}>{queue}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleFetchJobs}
                disabled={isFetching}
                className="fetch-btn"
              >
                {isFetching ? 'Fetching...' : 'Fetch Jobs'}
              </button>
            </div>
          </div>
        )}

        {/* Fetched Jobs List */}
        {fetchedJobs.length > 0 && (
          <div className="fetched-jobs-section">
            <h4>Fetched Jobs ({fetchedJobs.length})</h4>
            <div className="jobs-list">
              {fetchedJobs.map((jobId) => (
                <div key={jobId} className="fetched-job-card">
                  <div className="job-id">{jobId}</div>
                  <div className="job-actions">
                    <button
                      onClick={() => handleCompleteJob(jobId)}
                      className="complete-btn"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleFailJob(jobId, 'Processing failed')}
                      className="fail-btn"
                    >
                      Fail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <div>{success}</div>
            {transactionDigest && (
              <div className="transaction-info">
                <div className="transaction-digest">
                  <strong>Transaction ID:</strong> 
                  <span className="digest-text">{transactionDigest}</span>
                </div>
                <a 
                  href={`${SUISCAN_BASE_URL}/tx/${transactionDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="suiscan-link"
                >
                  View on SUI Scan →
                </a>
              </div>
            )}
          </div>
        )}

        {subscriptionId && (
          <div className="subscription-info">
            <h4>Worker Subscription</h4>
            <div className="subscription-details">
              <div><strong>Subscription ID:</strong> {subscriptionId}</div>
              <div><strong>Subscribed Queues:</strong> {formData.queues.join(', ')}</div>
              <div><strong>Batch Size:</strong> {formData.batchSize}</div>
              <div><strong>Visibility Timeout:</strong> {formData.visibilityTimeout}s</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
