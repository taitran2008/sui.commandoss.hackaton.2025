'use client';

import { Task } from '@/types/task';
import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { suiJobService } from '@/lib/suiJobService';
import { useToast } from '@/components/ToastProvider';

interface JobManagementPanelProps {
  task: Task;
  onTaskUpdated: () => void;
}

export default function JobManagementPanel({ task, onTaskUpdated }: JobManagementPanelProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { addToast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Check user permissions
  const isSubmitter = account?.address === task.submitter;
  const canClaim = !isSubmitter && account?.address;
  const canReject = isSubmitter && task.completed && !task.completed; // Assuming completed jobs can be rejected

  const handleOperation = async (
    operation: string,
    operationFn: () => Promise<{ success: boolean; error?: string; jobId?: string }>
  ) => {
    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setIsProcessing(true);
    setActiveOperation(operation);

    try {
      const result = await operationFn();
      
      if (result.success) {
        addToast(`${operation} completed successfully!`, 'success');
        onTaskUpdated();
      } else {
        addToast(result.error || `Failed to ${operation.toLowerCase()}`, 'error');
      }
    } catch (error) {
      console.error(`Error during ${operation}:`, error);
      addToast(`Unexpected error during ${operation.toLowerCase()}`, 'error');
    } finally {
      setIsProcessing(false);
      setActiveOperation('');
    }
  };

  const handleClaimJob = () => {
    handleOperation('Claim Job', () => 
      suiJobService.claimJob(task.uuid, signAndExecuteTransaction)
    );
  };

  const handleCompleteJob = () => {
    const result = prompt('Enter your work result/completion message:');
    if (!result) return;
    
    // Note: The current completeJob method uses a hardcoded message
    // You might want to modify it to accept custom completion messages
    handleOperation('Complete Job', () => 
      suiJobService.completeJob(task.uuid, signAndExecuteTransaction)
    );
  };

  const handleRejectJob = () => {
    if (!rejectReason.trim()) {
      addToast('Please provide a rejection reason', 'error');
      return;
    }

    handleOperation('Reject Job', () => 
      suiJobService.rejectJob(task.uuid, rejectReason, signAndExecuteTransaction)
    );

    setShowRejectForm(false);
    setRejectReason('');
  };

  const handleVerifyAndRelease = () => {
    const confirmed = confirm(
      'Are you sure you want to verify this work and release payment? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    handleOperation('Verify & Release Payment', () => 
      suiJobService.verifyAndRelease(task.uuid, signAndExecuteTransaction)
    );
  };

  const getActionButtons = () => {
    const buttons = [];

    // Claim job button (for workers)
    if (canClaim && !task.completed) {
      buttons.push(
        <button
          key="claim"
          onClick={handleClaimJob}
          disabled={isProcessing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {activeOperation === 'Claim Job' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Claiming...
            </>
          ) : (
            'Claim Job'
          )}
        </button>
      );
    }

    // Complete job button (for the worker who claimed it)
    if (!isSubmitter && task.completed === false) {
      buttons.push(
        <button
          key="complete"
          onClick={handleCompleteJob}
          disabled={isProcessing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {activeOperation === 'Complete Job' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Completing...
            </>
          ) : (
            'Complete Job'
          )}
        </button>
      );
    }

    // Verify & Release button (for job submitter)
    if (isSubmitter && task.completed) {
      buttons.push(
        <button
          key="verify"
          onClick={handleVerifyAndRelease}
          disabled={isProcessing}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {activeOperation === 'Verify & Release Payment' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Verifying...
            </>
          ) : (
            'Verify & Release Payment'
          )}
        </button>
      );
    }

    // Reject job button (for job submitter)
    if (canReject) {
      buttons.push(
        <button
          key="reject"
          onClick={() => setShowRejectForm(true)}
          disabled={isProcessing}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reject Work
        </button>
      );
    }

    return buttons;
  };

  const actionButtons = getActionButtons();

  if (actionButtons.length === 0) {
    return null; // No actions available for this user
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
      <h4 className="text-sm font-medium text-gray-800 mb-3">Job Actions</h4>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {actionButtons}
      </div>

      {showRejectForm && (
        <div className="mt-4 p-4 bg-white rounded-md border border-red-200">
          <h5 className="text-sm font-medium text-gray-800 mb-2">Reject Job</h5>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Please provide a reason for rejection..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRejectJob}
              disabled={isProcessing || !rejectReason.trim()}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {activeOperation === 'Reject Job' ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Rejecting...
                </>
              ) : (
                'Submit Rejection'
              )}
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectReason('');
              }}
              disabled={isProcessing}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="mt-2 text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded">
          Processing {activeOperation.toLowerCase()}...
        </div>
      )}
    </div>
  );
}
