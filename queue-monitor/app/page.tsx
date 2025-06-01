'use client'

import { useState, useEffect, useCallback } from 'react'
import { WalletConnection } from './components/WalletConnection'
import { WalletJobList } from './components/WalletJobList'
import { WalletSelector } from './components/WalletSelector'
import { JobSubmissionForm } from './components/JobSubmissionForm'
import { WalletJob } from './utils/walletJobsService'

export default function Home() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null)
  const [jobs, setJobs] = useState<WalletJob[]>([])
  const [showJobForm, setShowJobForm] = useState(false)
  const [jobListKey, setJobListKey] = useState(0) // Key to force re-render of job list

  // Handle wallet connection changes
  const handleWalletChange = useCallback((walletAddress: string | null) => {
    console.log('Wallet changed to:', walletAddress)
    setConnectedWallet(walletAddress)
    // Reset form when wallet changes
    setShowJobForm(false)
  }, [])

  // Handle jobs loaded
  const handleJobsLoaded = useCallback((loadedJobs: WalletJob[]) => {
    console.log(`${loadedJobs.length} jobs loaded`)
    setJobs(loadedJobs)
  }, [])

  // Handle job submitted
  const handleJobSubmitted = useCallback((jobId: string, txHash: string) => {
    console.log(`Job submitted: ${jobId}, Transaction: ${txHash}`)
    // Hide the form
    setShowJobForm(false)
    // Force refresh of job list by updating the key
    setJobListKey(prev => prev + 1)
  }, [])

  // Handle showing job form
  const handleShowJobForm = useCallback(() => {
    setShowJobForm(true)
  }, [])

  // Handle hiding job form
  const handleHideJobForm = useCallback(() => {
    setShowJobForm(false)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">SUI Job Queue Monitor</h1>
          <p className="text-gray-600 mt-2">Monitor and manage jobs on the SUI blockchain</p>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - left side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Blockchain Jobs</h2>
                  {connectedWallet && !showJobForm && (
                    <button
                      onClick={handleShowJobForm}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-sm"
                    >
                      ➕ Submit New Job
                    </button>
                  )}
                </div>
                
                {/* Show job submission form when requested */}
                {showJobForm && connectedWallet && (
                  <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Submit New Job</h3>
                      <button
                        onClick={handleHideJobForm}
                        className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    <JobSubmissionForm onJobSubmitted={handleJobSubmitted} />
                  </div>
                )}
                
                {/* Show connected wallet's jobs */}
                {connectedWallet ? (
                  <WalletJobList 
                    key={jobListKey} // Force re-render when key changes
                    onJobsLoaded={handleJobsLoaded}
                    refreshInterval={30000} 
                  />
                ) : (
                  /* Show demo wallet selector when not connected */
                  <WalletSelector />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - right side */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300 sticky top-8">
              <WalletConnection onWalletChange={handleWalletChange} />
              
              {/* Job statistics when wallet is connected */}
              {connectedWallet && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    Job Statistics
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Jobs:</span>
                      <span className="font-medium text-gray-800">{jobs.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Open Jobs:</span>
                      <span className="font-medium text-green-600">
                        {jobs.filter(j => j.status === 'open').length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {jobs.filter(j => j.status === 'claimed').length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-gray-600">
                        {jobs.filter(j => j.status === 'completed').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
