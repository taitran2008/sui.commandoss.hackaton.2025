'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchWalletJobs, refreshJobStatus, WalletJob } from '../utils/walletJobsService'
import { useCurrentAccount } from '@mysten/dapp-kit'

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

  // Use specified wallet address or default to connected wallet
  const targetWallet = walletAddress || account?.address

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
            onClick={refreshJobs}
            disabled={loading}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {jobs.map((job, index) => (
          <div 
            key={job.id} 
            className="group border border-gray-200 rounded-xl p-5 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-300 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 bg-white"
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
    </div>
  )
}
