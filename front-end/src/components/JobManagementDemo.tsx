'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useSuiJobs } from '@/hooks/useSuiJobs';
import TaskCard from '@/components/TaskCard';
import JobSubmissionForm from '@/components/JobSubmissionForm';
import { useToast } from '@/components/ToastProvider';

export default function JobManagementDemo() {
  const account = useCurrentAccount();
  const { tasks, loading, error, refetch, balance } = useSuiJobs();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse');

  const handleJobSubmitted = (jobId: string) => {
    addToast(`Job ${jobId} submitted successfully!`, 'success');
    // Refresh the job list
    setTimeout(() => refetch(), 2000);
    setActiveTab('browse');
  };

  const handleJobRefresh = () => {
    refetch();
  };

  if (!account?.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">SUI Job Management System</h1>
          <p className="text-gray-600 mb-8">Connect your wallet to manage blockchain jobs</p>
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Wallet Required</h3>
            <p className="text-gray-600">Please connect your SUI wallet to access the job management features</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">SUI Job Management System</h1>
        <p className="text-gray-600">Complete workflow demonstration for blockchain job management</p>
        
        {/* Wallet Info */}
        <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">
                <strong>Wallet:</strong> {account.address.slice(0, 10)}...{account.address.slice(-6)}
              </p>
              <p className="text-sm text-blue-600">
                <strong>Balance:</strong> {balance.toFixed(4)} SUI
              </p>
            </div>
            <button
              onClick={refetch}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'browse'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Browse Jobs ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'submit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Submit New Job
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'browse' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Your Jobs</h2>
            <p className="text-gray-600">
              Manage your submitted jobs and interact with available jobs from other users
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error loading jobs: {error}</p>
              <button
                onClick={refetch}
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-gray-600">Loading jobs...</span>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Jobs Found</h3>
              <p className="text-gray-600 mb-4">You haven&apos;t submitted any jobs yet</p>
              <button
                onClick={() => setActiveTab('submit')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Your First Job
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {tasks.map((task) => (
                <TaskCard
                  key={task.uuid}
                  task={task}
                  onTaskDeleted={() => {
                    addToast('Job deleted successfully', 'success');
                    refetch();
                  }}
                  onJobRefresh={handleJobRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'submit' && (
        <div>
          <JobSubmissionForm onJobSubmitted={handleJobSubmitted} />
        </div>
      )}

      {/* Feature Summary */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Workflows</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">✅ Job Submission</h4>
            <p className="text-sm text-gray-600">Create new jobs with metadata, rewards, and timeouts</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">⚡ Job Claims</h4>
            <p className="text-sm text-gray-600">Workers can claim available jobs</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">📋 Job Completion</h4>
            <p className="text-sm text-gray-600">Submit work results and mark jobs complete</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">❌ Job Rejection</h4>
            <p className="text-sm text-gray-600">Reject poor quality work and reassign</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">💰 Payment Release</h4>
            <p className="text-sm text-gray-600">Verify work and release payment to workers</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">🗑️ Job Deletion</h4>
            <p className="text-sm text-gray-600">Self-verification workflow for job cleanup</p>
          </div>
        </div>
      </div>
    </div>
  );
}
