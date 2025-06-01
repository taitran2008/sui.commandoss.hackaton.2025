'use client'

import { useState, useCallback } from 'react'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONTRACT_CONFIG } from '../constants/contract'

interface JobSubmissionFormProps {
  onJobSubmitted?: (jobId: string, txHash: string) => void
}

interface JobFormData {
  task: string
  description: string
  rewardAmount: string
  timeoutMinutes: string
  urgency: 'low' | 'standard' | 'high' | 'urgent'
  category: string
}

// Predefined job templates inspired by case1.js
const JOB_TEMPLATES = {
  translation: {
    task: 'translation',
    description: 'Translate 100 words into French',
    category: 'language',
    urgency: 'standard' as const,
    suggestedReward: '0.1'
  },
  dataAnalysis: {
    task: 'data-analysis',
    description: 'Analyze customer data and provide insights',
    category: 'analytics',
    urgency: 'standard' as const,
    suggestedReward: '0.2'
  },
  imageProcessing: {
    task: 'image-processing',
    description: 'Resize and optimize product images',
    category: 'media',
    urgency: 'low' as const,
    suggestedReward: '0.05'
  },
  contentWriting: {
    task: 'content-writing',
    description: 'Write a 500-word article on blockchain technology',
    category: 'writing',
    urgency: 'standard' as const,
    suggestedReward: '0.15'
  },
  webScraping: {
    task: 'web-scraping',
    description: 'Extract product data from e-commerce websites',
    category: 'automation',
    urgency: 'high' as const,
    suggestedReward: '0.3'
  }
}

export function JobSubmissionForm({ onJobSubmitted }: JobSubmissionFormProps) {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  
  const [formData, setFormData] = useState<JobFormData>({
    task: '',
    description: '',
    rewardAmount: '0.1',
    timeoutMinutes: '30',
    urgency: 'standard',
    category: ''
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Generate unique job UUID like in case1.js
  const generateJobUuid = useCallback(() => {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }, [])

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(null)
  }, [])

  // Apply job template
  const applyTemplate = useCallback((templateKey: keyof typeof JOB_TEMPLATES) => {
    const template = JOB_TEMPLATES[templateKey]
    setFormData(prev => ({
      ...prev,
      task: template.task,
      description: template.description,
      category: template.category,
      urgency: template.urgency,
      rewardAmount: template.suggestedReward
    }))
  }, [])

  // Create job payload like in case1.js
  const createJobPayload = useCallback((jobUuid: string) => {
    return JSON.stringify({
      uuid: jobUuid,
      task: formData.task,
      description: formData.description,
      category: formData.category,
      urgency: formData.urgency,
      submitter: account?.address,
      timestamp: new Date().toISOString(),
      estimated_duration: `${formData.timeoutMinutes} minutes`,
      reward_amount: `${formData.rewardAmount} SUI`
    })
  }, [formData, account?.address])

  // Submit job to blockchain (inspired by case1.js Alice's job submission)
  const submitJob = useCallback(async () => {
    if (!account?.address) {
      setError('Please connect your wallet first')
      return
    }

    if (!formData.task || !formData.description || !formData.rewardAmount) {
      setError('Please fill in all required fields')
      return
    }

    const rewardAmountNumber = parseFloat(formData.rewardAmount)
    if (isNaN(rewardAmountNumber) || rewardAmountNumber <= 0) {
      setError('Reward amount must be a positive number')
      return
    }

    const timeoutNumber = parseInt(formData.timeoutMinutes)
    if (isNaN(timeoutNumber) || timeoutNumber < 30) {
      setError('Timeout must be at least 30 minutes')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('🚀 Submitting job to blockchain...')
      
      // Generate unique job UUID
      const jobUuid = generateJobUuid()
      const jobPayload = createJobPayload(jobUuid)
      
      console.log(`🆔 Job UUID: ${jobUuid}`)
      console.log(`📦 Job Payload: ${jobPayload}`)
      console.log(`💰 Reward: ${rewardAmountNumber} SUI`)
      console.log(`⏰ Timeout: ${timeoutNumber} minutes`)

      // Create transaction (following case1.js pattern)
      const submitTxb = new Transaction()
      
      // Convert SUI to MIST (1 SUI = 1e9 MIST)
      const rewardInMist = Math.floor(rewardAmountNumber * 1e9)
      const [coin] = submitTxb.splitCoins(submitTxb.gas, [submitTxb.pure.u64(rewardInMist)])
      
      submitTxb.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::job_queue::submit_job`,
        arguments: [
          submitTxb.object(CONTRACT_CONFIG.MANAGER_OBJECT_ID),
          submitTxb.pure.string(jobPayload), // description parameter
          coin, // reward parameter
          submitTxb.pure.u64(timeoutNumber), // timeout_minutes parameter
          submitTxb.object(CONTRACT_CONFIG.CLOCK_OBJECT_ID),
        ],
      })

      // Sign and execute transaction
      const submitResult = await signAndExecuteTransaction({
        transaction: submitTxb,
      })

      console.log('✅ Job submitted successfully!')
      console.log('Transaction digest:', submitResult.digest)

      // Wait for transaction to be indexed with retry mechanism
      const waitForTransaction = async (digest: string, maxRetries = 10, baseDelay = 1000) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`⏳ Querying transaction (attempt ${attempt}/${maxRetries})...`)
            
            const txDetails = await suiClient.getTransactionBlock({
              digest,
              options: {
                showEffects: true,
                showEvents: true,
              },
            })
            
            console.log('✅ Transaction found and retrieved')
            return txDetails
            
          } catch (error) {
            console.log(`❌ Attempt ${attempt} failed:`, error instanceof Error ? error.message : error)
            
            if (attempt === maxRetries) {
              throw new Error(`Failed to retrieve transaction after ${maxRetries} attempts. The transaction may still be processing.`)
            }
            
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
            console.log(`⏱️ Waiting ${Math.round(delay)}ms before next attempt...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
        // This should never be reached due to the throw above, but TypeScript needs this
        throw new Error('Failed to retrieve transaction')
      }

      const txDetails = await waitForTransaction(submitResult.digest)

      // Check if transaction details were retrieved
      if (!txDetails) {
        throw new Error('Failed to retrieve transaction details')
      }

      // Check if transaction was successful
      const isSuccessful = txDetails.effects?.status?.status === 'success'
      
      if (!isSuccessful) {
        throw new Error('Job submission transaction failed')
      }

      // Extract job ID from created objects
      let jobId = null
      if (txDetails.effects?.created) {
        const createdObjects = txDetails.effects.created
        const jobObject = createdObjects.find((obj: any) => 
          obj.owner && typeof obj.owner === 'object' && 'Shared' in obj.owner
        )
        if (jobObject) {
          jobId = jobObject.reference.objectId
          console.log(`🆔 Job Object ID: ${jobId}`)
        }
      }

      // Check for JobSubmitted event
      const submitEvent = txDetails.events?.find((e: any) => e.type.includes('JobSubmitted'))
      if (submitEvent) {
        console.log(`📢 JobSubmitted event:`, submitEvent.parsedJson)
      }

      setSuccess(`Job submitted successfully! Job ID: ${jobId || 'Unknown'}`)
      
      // Reset form
      setFormData({
        task: '',
        description: '',
        rewardAmount: '0.1',
        timeoutMinutes: '30',
        urgency: 'standard',
        category: ''
      })

      // Notify parent component
      if (onJobSubmitted && jobId) {
        onJobSubmitted(jobId, submitResult.digest)
      }

    } catch (err) {
      console.error('❌ Job submission failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit job')
    } finally {
      setIsSubmitting(false)
    }
  }, [account, formData, suiClient, signAndExecuteTransaction, generateJobUuid, createJobPayload, onJobSubmitted])

  if (!account?.address) {
    return (
      <div className="job-submission-form bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Wallet to Submit Jobs</h3>
          <p className="text-gray-500">Connect your SUI wallet to submit jobs to the blockchain</p>
        </div>
      </div>
    )
  }

  return (
    <div className="job-submission-form bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Submit New Job</h2>
        <p className="text-gray-600">Create a new job on the SUI blockchain for workers to complete</p>
      </div>

      {/* Job Templates */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Quick Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(JOB_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => applyTemplate(key as keyof typeof JOB_TEMPLATES)}
              className="text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <div className="font-medium text-blue-800 capitalize">
                {template.task.replace('-', ' ')}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {template.suggestedReward} SUI • {template.urgency}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={(e) => { e.preventDefault(); submitJob(); }} className="space-y-4">
        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Name *
          </label>
          <input
            type="text"
            value={formData.task}
            onChange={(e) => handleInputChange('task', e.target.value)}
            placeholder="e.g., translation, data-analysis, image-processing"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Detailed description of the job requirements..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Category and Urgency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              placeholder="e.g., language, analytics, media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urgency
            </label>
            <select
              value={formData.urgency}
              onChange={(e) => handleInputChange('urgency', e.target.value as JobFormData['urgency'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Reward and Timeout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reward Amount (SUI) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.rewardAmount}
              onChange={(e) => handleInputChange('rewardAmount', e.target.value)}
              placeholder="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (minutes) *
            </label>
            <input
              type="number"
              min="30"
              value={formData.timeoutMinutes}
              onChange={(e) => handleInputChange('timeoutMinutes', e.target.value)}
              placeholder="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{success}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Submitting Job...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Submit Job to Blockchain
            </>
          )}
        </button>
      </form>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Connected Wallet:</strong> {account.address.slice(0, 10)}...{account.address.slice(-6)}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Jobs are submitted to the SUI testnet. Minimum timeout is 30 minutes.
        </p>
      </div>
    </div>
  )
}
