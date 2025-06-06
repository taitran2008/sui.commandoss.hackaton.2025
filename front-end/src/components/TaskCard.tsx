'use client';

import { Task, TASK_STATUS, TASK_STATUS_LABELS } from '@/types/task';
import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { suiJobService } from '@/lib/suiJobService';
import { useToast } from '@/components/ToastProvider';
import AddressDisplay from './AddressDisplay';
import JobManagementPanel from './JobManagementPanel';

interface TaskCardProps {
  task: Task;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted: (uuid: string) => void;
  onJobRefresh?: () => void;
  readOnly?: boolean;
}

export default function TaskCard({ task, onTaskDeleted, onJobRefresh, readOnly = false }: TaskCardProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { addToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<string>('');

  // Check if user can delete this task (must be the submitter)
  const canDelete = account?.address === task.submitter;

  // For SUI blockchain jobs, we'll disable direct updates and deletions
  // These would require blockchain transactions
  const handleViewOnExplorer = () => {
    // Open SUI explorer with the job ID using the service
    const explorerUrl = suiJobService.getExplorerUrl(task.uuid, 'object');
    window.open(explorerUrl, '_blank');
  };

  const handleDeleteJob = async () => {
    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    if (!canDelete) {
      addToast('You can only delete jobs you submitted', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    
    try {
      // Use the complete workflow from suiJobService
      const result = await suiJobService.deleteJobWorkflow(
        task.uuid,
        signAndExecuteTransaction,
        (step: number, message: string) => {
          setDeleteStep(message);
          addToast(message, 'info', 2000);
        }
      );

      if (result.success) {
        addToast('Job deleted successfully! Storage rebate received.', 'success');
        onTaskDeleted(task.uuid);
      } else {
        addToast(result.error || 'Failed to delete job', 'error');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      addToast('Unexpected error occurred while deleting job', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteStep('');
    }
  };


  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'standard': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case TASK_STATUS.PENDING: return 'bg-blue-100 text-blue-800';
      case TASK_STATUS.CLAIMED: return 'bg-yellow-100 text-yellow-800';
      case TASK_STATUS.COMPLETED: return 'bg-purple-100 text-purple-800';
      case TASK_STATUS.VERIFIED: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 transition-all duration-200 hover:shadow-lg ${
      task.status === TASK_STATUS.VERIFIED ? 'border-green-500 bg-gray-50' : 
      task.status === TASK_STATUS.COMPLETED ? 'border-purple-500' :
      task.status === TASK_STATUS.CLAIMED ? 'border-yellow-500' : 'border-blue-500'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className={`text-lg font-semibold ${task.status === TASK_STATUS.VERIFIED ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
              {task.task}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(task.urgency)}`}>
              {task.urgency}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </div>
          
          <p className={`text-sm mb-3 ${task.status === TASK_STATUS.VERIFIED ? 'text-gray-400' : 'text-gray-600'}`}>
            {task.description}
          </p>

          {/* Show worker information if task is claimed or beyond */}
          {task.worker && task.status >= TASK_STATUS.CLAIMED && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs text-blue-700">
                <span className="font-medium">Worker:</span>{' '}
                <AddressDisplay address={task.worker} showCopyButton={true} />
              </div>
            </div>
          )}

          {/* Show result if task is completed */}
          {task.result && task.status >= TASK_STATUS.COMPLETED && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Work Result:</span>
                <p className="mt-1 text-gray-600">{task.result}</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Category:</span> {task.category}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {task.estimated_duration}
            </div>
            <div>
              <span className="font-medium">Reward:</span> {task.reward_amount}
            </div>
            <div>
              <span className="font-medium">Submitter:</span>{' '}
              <AddressDisplay address={task.submitter} showCopyButton={true} />
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-400">
            <span className="font-medium">Job ID:</span>{' '}
            <span className="font-mono break-all">{task.uuid}</span>
          </div>
          
          <div className="mt-1 text-xs text-gray-400">
            <span className="font-medium">Created:</span> {formatTimestamp(task.timestamp)}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={handleViewOnExplorer}
            className="px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
          >
            View on Explorer
          </button>
          
          {!readOnly && canDelete && (
            <button
              onClick={handleDeleteJob}
              disabled={isDeleting || task.completed}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isDeleting || task.completed
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
              title={task.completed ? 'Cannot delete completed jobs' : 'Delete this job (self-verification workflow)'}
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </div>
              ) : (
                'Delete Job'
              )}
            </button>
          )}
        </div>
        
        {isDeleting && deleteStep && (
          <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            {deleteStep}
          </div>
        )}
      </div>

      {/* Job Management Panel - only show when not in read-only mode */}
      {!readOnly && (
        <div className="mt-4">
          <JobManagementPanel 
            task={task} 
            onTaskUpdated={() => onJobRefresh?.()} 
          />
        </div>
      )}
      
      {/* Read-only mode info */}
      {readOnly && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-700">
            <span className="font-medium">👀 Read-only view:</span> Connect your wallet to claim jobs and interact with the blockchain.
          </div>
        </div>
      )}
    </div>
  );
}
