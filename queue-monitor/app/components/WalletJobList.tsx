'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchWalletJobs, refreshJobStatus, WalletJob } from '../utils/walletJobsService'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { JobDetailModal } from './JobDetailModal'

// Helper function to format job title
const formatJobTitle = (name: string): string => {
  if (!name) return 'Untitled Job'
  
  // Convert kebab-case to Title Case
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

interface WalletJobListProps {
  walletAddress?: string // Optional. If not provided, uses connected wallet
  refreshInterval?: number // Optional refresh interval in ms
  onJobsLoaded?: (jobs: WalletJob[]) => void
}

export function WalletJobList({
  walletAddress,
  refreshInterval = 0,
  onJobsLoaded
}: WalletJobListProps) {
  const account = useCurrentAccount()
  const [jobs, setJobs] = useState<WalletJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selectedJob, setSelectedJob] = useState<WalletJob | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use specified wallet address or default to connected wallet
  const targetWallet = walletAddress || account?.address

  // Handle job click
  const handleJobClick = (job: WalletJob) => {
    console.log('🔥 Job clicked:', job.name, job.id)
    console.log('🔥 Setting modal state...')
    setSelectedJob(job)
    setIsModalOpen(true)
    console.log('🔥 Modal state set:', { selectedJob: job.name, isModalOpen: true })
    
    // Additional debugging
    setTimeout(() => {
      console.log('🔥 Modal state after timeout:', { 
        selectedJob: selectedJob?.name, 
        isModalOpen 
      })
      // Check if modal div exists in DOM
      const modalElement = document.querySelector('[data-modal="job-detail"]')
      console.log('🔥 Modal element in DOM:', modalElement ? 'Found' : 'Not found')
    }, 100)
  }

  // Handle modal close
  const handleModalClose = () => {
    console.log('Modal closing')
    setIsModalOpen(false)
    setSelectedJob(null)
  }

  const loadJobs = useCallback(async () => {
    if (!targetWallet) return
    
    setLoading(true)
    setError(null)
    
    try {
      console.log(`Loading jobs for wallet: ${targetWallet}`)
      const walletJobs = await fetchWalletJobs(targetWallet)
      console.log(`Loaded ${walletJobs.length} jobs`)
      setJobs(walletJobs)
      setLastRefresh(new Date())
      
      // Notify parent if callback provided
      if (onJobsLoaded) {
        onJobsLoaded(walletJobs)
      }
    } catch (err) {
      console.error('Error loading wallet jobs:', err)
      setError('Failed to load jobs from blockchain')
    } finally {
      setLoading(false)
    }
  }, [targetWallet, onJobsLoaded])

  // Refresh all job statuses
  const refreshJobs = useCallback(async () => {
    if (!targetWallet || jobs.length === 0) return
    
    setLoading(true)
    try {
      const refreshedJobs = await Promise.all(
        jobs.map(job => refreshJobStatus(job))
      )
      setJobs(refreshedJobs)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error refreshing jobs:', err)
      setError('Failed to refresh job statuses')
    } finally {
      setLoading(false)
    }
  }, [targetWallet, jobs])

  // Load jobs when wallet changes
  useEffect(() => {
    loadJobs()
  }, [targetWallet, loadJobs])

  // Set up auto-refresh interval if specified
  useEffect(() => {
    if (refreshInterval > 0 && targetWallet) {
      const interval = setInterval(() => {
        console.log('Auto-refreshing jobs...')
        refreshJobs()
      }, refreshInterval)
      
      return () => clearInterval(interval)
    }
  }, [refreshInterval, targetWallet, refreshJobs])

  // Show loading state
  if (loading && jobs.length === 0) {
    return (
      <div className="wallet-job-list loading">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-gray-500">Loading jobs from the blockchain...</p>
        </div>
      </div>
    )
  }

  // Show connect wallet prompt
  if (!targetWallet) {
    return (
      <div className="wallet-job-list no-wallet">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500">Connect your SUI wallet to view your blockchain jobs</p>
        </div>
      </div>
    )
  }

  // Show empty state
  if (jobs.length === 0) {
    return (
      <div className="wallet-job-list empty">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
          <p className="text-gray-500">
            {walletAddress 
              ? `This wallet doesn't have any jobs yet`
              : `You haven't submitted any jobs yet. Use the job submission form to create your first job.`
            }
          </p>
          <button 
            onClick={loadJobs} 
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="wallet-job-list error mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
        <button 
          onClick={loadJobs} 
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Show jobs list
  return (
    <div className="wallet-job-list">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">
            {walletAddress ? 'Wallet Jobs' : 'My Jobs'}
          </h2>
          <p className="text-sm text-gray-500">
            {`${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} total`}
            {lastRefresh && (
              <span className="ml-2 text-xs">
                • Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              console.log('🔥 Test button clicked')
              if (jobs.length > 0) {
                handleJobClick(jobs[0])
              } else {
                // Create a dummy job for testing
                const dummyJob: WalletJob = {
                  id: 'test-123',
                  name: 'Test Job',
                  status: 'Processing',
                  timestamp: 'Just now'
                }
                handleJobClick(dummyJob)
              }
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Test Modal
          </button>
          <button 
            onClick={() => {
              console.log('🔥 Simple alert test')
              alert('This alert works - so JavaScript is working')
            }}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          >
            Test Alert
          </button>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {jobs.map((job, index) => (
          <div 
            key={job.id} 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleJobClick(job)
            }}
            className="group border border-gray-200 rounded-xl p-5 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-300 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 bg-white cursor-pointer"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    job.status === 'Completed' ? 'bg-emerald-500' :
                    job.status === 'Processing' ? 'bg-blue-500 animate-pulse' :
                    job.status === 'Pending' ? 'bg-amber-500' :
                    job.status === 'Cancelled' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`}></div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-900 transition-colors text-lg truncate">
                    {formatJobTitle(job.name)}
                  </h3>
                  <p className="text-xs text-blue-600 opacity-75 font-medium">Click to view details</p>
                </div>
                <div className="space-y-1 ml-6">
                  <p className="text-sm text-gray-500 font-mono opacity-75">ID: {job.id.slice(0, 20)}...</p>
                  {job.rewardAmount && (
                    <p className="text-sm text-green-600 font-medium">Reward: {job.rewardAmount.toFixed(4)} SUI</p>
                  )}
                  {job.worker && (
                    <p className="text-sm text-blue-600">Worker: {job.worker.slice(0, 10)}...{job.worker.slice(-6)}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 min-w-[100px] justify-center ${
                  job.status === 'Completed' 
                    ? 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200' :
                  job.status === 'Processing' 
                    ? 'bg-blue-100 text-blue-800 group-hover:bg-blue-200' :
                  job.status === 'Pending' 
                    ? 'bg-amber-100 text-amber-800 group-hover:bg-amber-200' :
                  job.status === 'Cancelled'
                    ? 'bg-red-100 text-red-800 group-hover:bg-red-200' :
                  'bg-gray-100 text-gray-800 group-hover:bg-gray-200'
                }`}>
                  {job.status}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{job.timestamp}</span>
                </div>
                {job.result && (
                  <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    Result Available
                  </div>
                )}
              </div>
            </div>
            
            {/* Expandable details section */}
            {job.description && job.description !== job.name && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Description: </span>
                  <span className="line-clamp-2">{job.description}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Job Detail Modal - Temporarily disabled */}
      {/*
      <JobDetailModal 
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
      */}

      {/* Simple modal for testing - Using inline styles to avoid CSS conflicts */}
      {isModalOpen && selectedJob && (
        <div 
          data-modal="job-detail"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={handleModalClose}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '10px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              position: 'relative',
              zIndex: 100000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#333' }}>
              Job Details
            </h3>
            <div style={{ marginBottom: '15px' }}>
              <strong>Job Name:</strong> {selectedJob.name}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>Status:</strong> {selectedJob.status}
            </div>
            <div style={{ marginBottom: '15px' }}>
              <strong>ID:</strong> {selectedJob.id.slice(0, 20)}...
            </div>
            {selectedJob.description && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Description:</strong> {selectedJob.description}
              </div>
            )}
            {selectedJob.rewardAmount && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Reward:</strong> {selectedJob.rewardAmount} SUI
              </div>
            )}
            <button 
              onClick={handleModalClose}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Close Modal
            </button>
          </div>
        </div>
      )}

      {/* Debug indicator */}
      {isModalOpen && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-2 rounded z-[10001]">
          Modal should be open: {selectedJob?.name}
        </div>
      )}
    </div>
  )
}
