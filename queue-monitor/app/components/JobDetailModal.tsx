'use client'

import { useEffect } from 'react'
import { WalletJob } from '../utils/walletJobsService'

interface JobDetailModalProps {
  job: WalletJob | null
  isOpen: boolean
  onClose: () => void
}

export function JobDetailModal({ job, isOpen, onClose }: JobDetailModalProps) {
  console.log('JobDetailModal render:', { isOpen, jobId: job?.id })

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !job) {
    console.log('JobDetailModal not rendering:', { isOpen, hasJob: !!job })
    return null
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Job Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Basic Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Basic Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Job Name:</span>
                <span className="font-semibold">{job.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Job ID:</span>
                <div className="flex items-center">
                  <span className="font-mono text-sm">{job.id.slice(0, 20)}...</span>
                  <button
                    onClick={() => copyToClipboard(job.id)}
                    className="ml-2 text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reward:</span>
                <span className="font-semibold">{job.rewardAmount} SUI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  job.status === 'completed' ? 'bg-green-100 text-green-800' :
                  job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  job.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {job.status}
                </span>
              </div>
            </div>
          </div>

          {/* Worker Info
          {job.workerAddress && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Worker Information</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">Worker Address:</span>
                <div className="flex items-center">
                  <span className="font-mono text-sm">{job.workerAddress.slice(0, 20)}...</span>
                  <button
                    onClick={() => copyToClipboard(job.workerAddress!)}
                    className="ml-2 text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )} */}

          {/* Timeline
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span>{job.createdAt}</span>
              </div>
              {job.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span>{job.updatedAt}</span>
                </div>
              )}
            </div>
          </div> */}

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Description</h3>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-gray-700">
                {job.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Results */}
          {job.result && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Results</h3>
              <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
