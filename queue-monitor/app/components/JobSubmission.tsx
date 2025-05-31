'use client'

import { useState } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { CONTRACT_CONFIG, COMMON_QUEUES, DEFAULT_STAKE_AMOUNT, MIN_STAKE_AMOUNT, MAX_PAYLOAD_SIZE, SUISCAN_BASE_URL } from '../constants/contract'

interface JobSubmissionProps {
  onJobSubmitted?: (jobId: string) => void
}

export function JobSubmission({ onJobSubmitted }: JobSubmissionProps) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
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
    if (!formData.queue.trim()) {
      return 'Queue name is required'
    }
    if (!formData.payload.trim()) {
      return 'Job payload is required'
    }
    if (formData.payload.length > MAX_PAYLOAD_SIZE) {
      return `Payload too large (max ${MAX_PAYLOAD_SIZE} bytes)`
    }
    
    const stakeInMist = parseFloat(formData.stakeAmount) * 1e9
    if (stakeInMist < MIN_STAKE_AMOUNT) {
      return `Minimum stake is ${MIN_STAKE_AMOUNT / 1e9} SUI`
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
      const txb = new Transaction()
      
      // Convert SUI to MIST (1 SUI = 1e9 MIST)
      const stakeInMist = Math.floor(parseFloat(formData.stakeAmount) * 1e9)
      
      // Split coins for staking
      const [stakeCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(stakeInMist)])
      
      // Call submit_job function
      txb.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::submit_job`,
        arguments: [
          txb.object(CONTRACT_CONFIG.MANAGER_OBJECT_ID),
          txb.pure.string(formData.jobId),
          txb.pure.string(formData.queue),
          txb.pure.string(formData.payload),
          stakeCoin,
          txb.object(CONTRACT_CONFIG.CLOCK_OBJECT_ID)
        ]
      })

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
              maxLength={MAX_PAYLOAD_SIZE}
              required
            />
            <small>{formData.payload.length}/{MAX_PAYLOAD_SIZE} characters</small>
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
