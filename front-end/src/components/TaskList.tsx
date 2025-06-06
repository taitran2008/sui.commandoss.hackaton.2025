'use client';

import { useState } from 'react';
import TaskCard from '@/components/TaskCard';
import TaskForm from '@/components/TaskForm';
import { sortTasks, filterTasks, getTaskStats } from '@/utils/taskUtils';
import WalletConnection from '@/components/WalletConnection';
import WalletBalance from '@/components/WalletBalance';
import WalletStatus from '@/components/WalletStatus';
import WalletErrorBoundary from '@/components/WalletErrorBoundary';
import { useSuiJobs } from '@/hooks/useSuiJobs';

interface TaskListProps {
  hostAddress?: string | null;
}

export default function TaskList({ hostAddress }: TaskListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'pending' | 'claimed'>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'urgency' | 'reward'>('timestamp');
  
  // Use SUI jobs hook with optional host address
  const { tasks, loading, error, refetch, isConnected } = useSuiJobs(hostAddress);

  const handleTaskCreated = () => {
    // When a task is created, refresh the jobs from blockchain
    refetch();
  };

  const handleTaskUpdated = () => {
    // When a task is updated, refresh the jobs from blockchain
    refetch();
  };

  const handleTaskDeleted = () => {
    // When a task is deleted, refresh the jobs from blockchain
    refetch();
  };

  const filteredTasks = filterTasks(tasks, filter);
  const sortedTasks = sortTasks(filteredTasks, sortBy);

  const stats = getTaskStats(tasks);

  // Show wallet connection prompt if not connected and no host address provided
  if (!isConnected && !hostAddress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 mb-6">
            Please connect your SUI wallet to view and manage your jobs.
          </p>
          <WalletErrorBoundary>
            <WalletConnection />
          </WalletErrorBoundary>
        </div>
      </div>
    );
  }

  // Determine if we should show read-only mode
  // Read-only when: hostAddress is provided AND user is not connected
  const isReadOnlyMode = !!hostAddress && !isConnected;

  // Show initial loading screen only if we have no tasks and are loading
  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading your jobs from SUI blockchain...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-600 text-xl mb-4">⚠️ Error Loading Jobs</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={refetch}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              SUI Job Management System
            </h1>
            <div className="space-y-1">
              <p className="text-gray-600">
                {hostAddress 
                  ? `Viewing jobs for: ${hostAddress.slice(0, 6)}...${hostAddress.slice(-4)}`
                  : "Manage your SUI blockchain jobs efficiently"
                } • Connected to SUI Testnet
              </p>
              {hostAddress && (
                <p className="text-sm text-blue-600">
                  {isConnected 
                    ? "📍 Viewing jobs from another user. You can claim available jobs with your connected wallet."
                    : "📍 Read-only view via URL parameter. Connect your wallet to manage jobs."
                  }
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Jobs
            </button>
            <WalletErrorBoundary>
              <WalletBalance />
            </WalletErrorBoundary>
          </div>
        </div>

        {/* Wallet Connection Section */}
        {hostAddress && !isConnected ? (
          // Show wallet connection when viewing host address but not connected
          <div className="mb-8">
            <WalletErrorBoundary>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div>
                    <div className="text-sm font-medium text-yellow-900">
                      Connect your wallet to claim jobs from this user
                    </div>
                    <div className="text-xs text-yellow-700 mt-1">
                      You&apos;re viewing jobs from {hostAddress.slice(0, 6)}...{hostAddress.slice(-4)}. Connect your wallet to claim available jobs.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <WalletConnection />
                <WalletStatus />
              </div>
            </WalletErrorBoundary>
          </div>
        ) : !hostAddress ? (
          // Show wallet connection section only when not using host address
          <div className="mb-8">
            <WalletErrorBoundary>
              <div className="flex items-center justify-between">
                <WalletConnection />
                <WalletStatus />
              </div>
            </WalletErrorBoundary>
          </div>
        ) : null}

        {/* Host Address Info - show when using host address */}
        {hostAddress && isConnected && (
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium text-green-900">
                    Viewing jobs for address: <span className="font-mono">{hostAddress}</span>
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    ✅ Your wallet is connected! You can claim and work on available jobs from this user.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Tasks</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending</h3>
            <p className="text-3xl font-bold text-blue-500">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Claimed</h3>
            <p className="text-3xl font-bold text-yellow-600">{stats.claimed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Awaiting Verification</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.awaitingVerification}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Rewards</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.totalReward.toFixed(2)} SUI</p>
          </div>
        </div>

        {/* Task Creation Form - only show when not using host address */}
        {!hostAddress && (
          <TaskForm onTaskCreated={handleTaskCreated} />
        )}

        {/* Filters and Sorting */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({tasks.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('claimed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'claimed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Claimed ({stats.claimed})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({stats.active})
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed ({stats.completed})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'urgency' | 'reward')}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="timestamp">Date Created</option>
                <option value="urgency">Urgency</option>
                <option value="reward">Reward Amount</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-6">
          {/* Show loading overlay when refreshing existing tasks */}
          {loading && tasks.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-700 font-medium">Refreshing jobs from blockchain...</span>
              </div>
            </div>
          )}
          
          {sortedTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">No jobs found</div>
              <p className="text-gray-500">
                {hostAddress 
                  ? `No jobs found for address ${hostAddress.slice(0, 6)}...${hostAddress.slice(-4)}. This address may not have submitted any jobs yet.`
                  : filter === 'all' 
                    ? 'No jobs found for your wallet address. Create your first job using the form above or check if you\'re connected to the correct wallet.' 
                    : `No ${filter} jobs available for your wallet.`
                }
              </p>
              <button
                onClick={refetch}
                disabled={loading}
                className="mt-4 text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                Refresh from blockchain
              </button>
            </div>
          ) : (
            <div className={`space-y-6 ${loading ? 'opacity-70 pointer-events-none' : ''}`}>
              {sortedTasks.map(task => (
                <TaskCard
                  key={task.uuid}
                  task={task}
                  onTaskUpdated={handleTaskUpdated}
                  onTaskDeleted={handleTaskDeleted}
                  onJobRefresh={refetch}
                  readOnly={isReadOnlyMode}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
