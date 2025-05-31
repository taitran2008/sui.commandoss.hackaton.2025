'use client'

import { useState } from 'react'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { 
  CONTRACT_CONFIG,
  CONTRACT_CONSTANTS, 
  COMMON_QUEUES, 
  DEFAULT_STAKE_AMOUNT, 
  MIN_STAKE_AMOUNT, 
  MAX_PAYLOAD_SIZE,
  SUISCAN_BASE_URL 
} from '../constants/contract'
import { JobQueueService } from '../utils/jobQueueService'
import type { JobSubmissionForm } from '../types'

interface JobSubmissionProps {
  onJobSubmitted?: (jobId: string) => void
}

export function JobSubmission({ onJobSubmitted }: JobSubmissionProps) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<JobSubmissionForm>({
    jobId: '',
    queue: 'image-processing',
    payload: '',
    stakeAmount: '0.001' // In SUI
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null)

  const generateJobId = () => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `job_${timestamp}_${random}`
  }

  const validateForm = () => {
    if (!formData.jobId.trim()) {
      return 'Job ID is required'
    }
    if (formData.jobId.length > 100) {
      return 'Job ID too long (max 100 characters)'
    }
    if (!formData.queue.trim()) {
      return 'Queue name is required'
    }
    if (formData.queue.length > CONTRACT_CONSTANTS.MAX_QUEUE_NAME_LENGTH) {
      return `Queue name too long (max ${CONTRACT_CONSTANTS.MAX_QUEUE_NAME_LENGTH} characters)`
    }
    if (!formData.payload.trim()) {
      return 'Job payload is required'
    }
    if (new Blob([formData.payload]).size > CONTRACT_CONSTANTS.MAX_PAYLOAD_SIZE) {
      return `Payload too large (max ${CONTRACT_CONSTANTS.MAX_PAYLOAD_SIZE} bytes)`
    }
    
    const stakeInMist = parseFloat(formData.stakeAmount) * 1e9
    if (stakeInMist < MIN_STAKE_AMOUNT) {
      return `Minimum stake is ${MIN_STAKE_AMOUNT / 1e9} SUI`
    }
    
    // Validate JSON if payload looks like JSON
    if (formData.payload.trim().startsWith('{') || formData.payload.trim().startsWith('[')) {
      try {
        JSON.parse(formData.payload)
      } catch {
        return 'Invalid JSON format in payload'
      }
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    setTransactionDigest(null)

    try {
      // Create JobQueueService instance
      const jobService = new JobQueueService(suiClient, account.address)
      
      // Convert SUI to MIST (1 SUI = 1e9 MIST)
      const stakeInMist = Math.floor(parseFloat(formData.stakeAmount) * 1e9)
      
      // Create transaction using the service
      const txb = jobService.createSubmitJobTransaction(
        formData.jobId,
        formData.queue,
        formData.payload,
        stakeInMist
      )

      signAndExecuteTransaction(
        {
          transaction: txb
        },
        {
          onSuccess: (result: any) => {
            console.log('Job submitted successfully:', result)
            const txDigest = result.digest
            setTransactionDigest(txDigest)
            setSuccess(`Job "${formData.jobId}" submitted successfully!`)
            setFormData({
              jobId: '',
              queue: 'image-processing',
              payload: '',
              stakeAmount: '0.001'
            })
            onJobSubmitted?.(formData.jobId)
          },
          onError: (error: any) => {
            console.error('Failed to submit job:', error)
            setError(`Failed to submit job: ${error.message}`)
          }
        }
      )
    } catch (error: any) {
      console.error('Error submitting job:', error)
      setError(`Error: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!account) {
    return (
      <div className="job-submission-wrapper">
        <div className="job-submission-card">
          <h3>Submit New Job</h3>
          <p>Connect your wallet to submit jobs to the queue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="job-submission-wrapper">
      <div className="job-submission-card">
        <div className="form-header">
          <h3>Submit New Job</h3>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, jobId: generateJobId() }))}
            className="generate-id-btn"
          >
            Generate ID
          </button>
        </div>

        <form onSubmit={handleSubmit} className="job-form">
          <div className="form-group">
            <label htmlFor="jobId">Job ID *</label>
            <input
              id="jobId"
              type="text"
              value={formData.jobId}
              onChange={(e) => setFormData(prev => ({ ...prev, jobId: e.target.value }))}
              placeholder="Enter unique job ID"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="queue">Queue *</label>
            <select
              id="queue"
              value={formData.queue}
              onChange={(e) => setFormData(prev => ({ ...prev, queue: e.target.value }))}
              required
            >
              {COMMON_QUEUES.map(queue => (
                <option key={queue} value={queue}>{queue}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="payload">Job Payload * (JSON format recommended)</label>
            <textarea
              id="payload"
              value={formData.payload}
              onChange={(e) => setFormData(prev => ({ ...prev, payload: e.target.value }))}
              placeholder='{"action": "process", "data": "your-data-here"}'
              rows={4}
              maxLength={CONTRACT_CONSTANTS.MAX_PAYLOAD_SIZE}
              required
            />
            <small>
              {new Blob([formData.payload]).size}/{CONTRACT_CONSTANTS.MAX_PAYLOAD_SIZE} bytes
              {formData.payload.trim().startsWith('{') || formData.payload.trim().startsWith('[') ? (
                <span className="json-indicator"> ✓ JSON format detected</span>
              ) : null}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="stakeAmount">Stake Amount (SUI) *</label>
            <input
              id="stakeAmount"
              type="number"
              step="0.000001"
              min={MIN_STAKE_AMOUNT / 1e9}
              value={formData.stakeAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, stakeAmount: e.target.value }))}
              required
            />
            <small>Higher stakes get priority processing (minimum: 0.000001 SUI)</small>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="submit-btn"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Job'}
          </button>
        </form>

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
      </div>
    </div>
  )
}
