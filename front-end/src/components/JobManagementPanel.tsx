'use client';

import { Task, TASK_STATUS } from '@/types/task';
import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { suiJobService } from '@/lib/suiJobService';
import { useToast } from '@/components/ToastProvider';
import { taskAPI } from '@/lib/taskAPI';

interface JobManagementPanelProps {
  task: Task;
  onTaskUpdated: () => void;
}

export default function JobManagementPanel({ task, onTaskUpdated }: JobManagementPanelProps) {
  const account = useCurrentAccount();
  const { addToast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [workResult, setWorkResult] = useState('');
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [isJobDeleted, setIsJobDeleted] = useState(false);

  // Check if job has been deleted from blockchain
  const checkIfJobDeleted = async () => {
    if (task.description === 'This job has been deleted from the blockchain') {
      setIsJobDeleted(true);
      return;
    }
    
    try {
      const jobDetails = await suiJobService.getJobDetails(task.uuid);
      setIsJobDeleted(jobDetails === null);
    } catch (error) {
      console.error('Error checking job status:', error);
      setIsJobDeleted(false);
    }
  };

  // Check job status on component mount and when task changes
  useState(() => {
    checkIfJobDeleted();
  });

  // Check user permissions based on new status system
  const isSubmitter = account?.address === task.submitter;
  const isWorker = account?.address === task.worker;
  const canClaim = !isSubmitter && account?.address && task.status === TASK_STATUS.PENDING && !isJobDeleted;
  const canSubmitWork = isWorker && task.status === TASK_STATUS.CLAIMED && !isJobDeleted;
  const canVerifyWork = isSubmitter && task.status === TASK_STATUS.COMPLETED && !isJobDeleted;
  const canRejectWork = isSubmitter && task.status === TASK_STATUS.COMPLETED && !isJobDeleted;

  const handleClaimJob = async () => {
    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setIsProcessing(true);
    setActiveOperation('Claim Job');

    try {
      // Use the taskAPI to claim the job
      await taskAPI.claimTask(task.uuid, account.address);
      addToast('Job claimed successfully!', 'success');
      onTaskUpdated();
    } catch (error) {
      console.error('Error claiming job:', error);
      addToast('Failed to claim job', 'error');
    } finally {
      setIsProcessing(false);
      setActiveOperation('');
    }
  };

  const handleSubmitWork = async () => {
    if (!workResult.trim()) {
      addToast('Please provide your work result', 'error');
      return;
    }

    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setIsProcessing(true);
    setActiveOperation('Submit Work');

    try {
      // Use the taskAPI to complete the job
      await taskAPI.completeTask(task.uuid, account.address, workResult);
      addToast('Work submitted successfully!', 'success');
      setShowWorkForm(false);
      setWorkResult('');
      onTaskUpdated();
    } catch (error) {
      console.error('Error submitting work:', error);
      addToast('Failed to submit work', 'error');
    } finally {
      setIsProcessing(false);
      setActiveOperation('');
    }
  };

  const handleVerifyWork = async () => {
    const confirmed = confirm(
      'Are you sure you want to verify this work and release payment? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setIsProcessing(true);
    setActiveOperation('Verify Work');

    try {
      // Use the taskAPI to verify the job
      await taskAPI.verifyTask(task.uuid, account.address);
      addToast('Work verified and payment released!', 'success');
      onTaskUpdated();
    } catch (error) {
      console.error('Error verifying work:', error);
      addToast('Failed to verify work', 'error');
    } finally {
      setIsProcessing(false);
      setActiveOperation('');
    }
  };

  const handleRejectWork = async () => {
    if (!rejectReason.trim()) {
      addToast('Please provide a rejection reason', 'error');
      return;
    }

    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    setIsProcessing(true);
    setActiveOperation('Reject Work');

    try {
      // Use the taskAPI to reject the job
      await taskAPI.rejectTask(task.uuid, account.address, rejectReason);
      addToast('Work rejected. Task is now available for claiming again.', 'success');
      setShowRejectForm(false);
      setRejectReason('');
      onTaskUpdated();
    } catch (error) {
      console.error('Error rejecting work:', error);
      addToast('Failed to reject work', 'error');
    } finally {
      setIsProcessing(false);
      setActiveOperation('');
    }
  };

  const getActionButtons = () => {
    const buttons = [];

    // Claim job button (for workers when task is PENDING)
    if (canClaim) {
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

    // Submit work button (for workers when task is CLAIMED)
    if (canSubmitWork) {
      buttons.push(
        <button
          key="submit-work"
          onClick={() => setShowWorkForm(true)}
          disabled={isProcessing}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Submit Work
        </button>
      );
    }

    // Verify work button (for job submitter when task is COMPLETED)
    if (canVerifyWork) {
      buttons.push(
        <button
          key="verify"
          onClick={handleVerifyWork}
          disabled={isProcessing}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {activeOperation === 'Verify Work' ? (
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

    // Reject work button (for job submitter when task is COMPLETED)
    if (canRejectWork) {
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

      {/* Work submission form */}
      {showWorkForm && (
        <div className="mt-4 p-4 bg-white rounded-md border border-green-200">
          <h5 className="text-sm font-medium text-gray-800 mb-2">Submit Your Work</h5>
          <textarea
            value={workResult}
            onChange={(e) => setWorkResult(e.target.value)}
            placeholder="Please describe your work and provide the results..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
            rows={4}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmitWork}
              disabled={isProcessing || !workResult.trim()}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {activeOperation === 'Submit Work' ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                'Submit Work'
              )}
            </button>
            <button
              onClick={() => {
                setShowWorkForm(false);
                setWorkResult('');
              }}
              disabled={isProcessing}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rejection form */}
      {showRejectForm && (
        <div className="mt-4 p-4 bg-white rounded-md border border-red-200">
          <h5 className="text-sm font-medium text-gray-800 mb-2">Reject Work</h5>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Please provide a reason for rejection..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRejectWork}
              disabled={isProcessing || !rejectReason.trim()}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {activeOperation === 'Reject Work' ? (
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
