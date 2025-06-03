'use client';

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { suiJobService } from '@/lib/suiJobService';
import { useToast } from '@/components/ToastProvider';

interface JobSubmissionFormProps {
  onJobSubmitted?: (jobId: string) => void;
}

const JOB_TEMPLATES = {
  translation: {
    task: 'Document Translation',
    description: 'Translate a 500-word document from English to Spanish',
    category: 'translation',
    urgency: 'standard' as const,
    rewardAmount: '0.5',
    timeoutMinutes: '120'
  },
  dataEntry: {
    task: 'Data Entry Task',
    description: 'Enter customer information from 50 business cards into spreadsheet format',
    category: 'data-entry',
    urgency: 'low' as const,
    rewardAmount: '0.2',
    timeoutMinutes: '180'
  },
  contentWriting: {
    task: 'Blog Post Writing',
    description: 'Write a 1000-word blog post about blockchain technology for beginners',
    category: 'writing',
    urgency: 'high' as const,
    rewardAmount: '1.0',
    timeoutMinutes: '240'
  },
  imageProcessing: {
    task: 'Image Enhancement',
    description: 'Enhance and resize 20 product images for e-commerce website',
    category: 'design',
    urgency: 'urgent' as const,
    rewardAmount: '0.8',
    timeoutMinutes: '60'
  }
};

export default function JobSubmissionForm({ onJobSubmitted }: JobSubmissionFormProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    task: '',
    description: '',
    category: '',
    urgency: 'standard' as 'low' | 'standard' | 'high' | 'urgent',
    rewardAmount: '0.1',
    timeoutMinutes: '60'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.task.trim()) {
      newErrors.task = 'Task title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    const rewardAmount = parseFloat(formData.rewardAmount);
    if (isNaN(rewardAmount) || rewardAmount <= 0) {
      newErrors.rewardAmount = 'Reward amount must be a positive number';
    }

    const timeoutMinutes = parseInt(formData.timeoutMinutes);
    if (isNaN(timeoutMinutes) || timeoutMinutes < 30 || timeoutMinutes > 2880) {
      newErrors.timeoutMinutes = 'Timeout must be between 30 and 2880 minutes (48 hours)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const applyTemplate = useCallback((templateKey: keyof typeof JOB_TEMPLATES) => {
    const template = JOB_TEMPLATES[templateKey];
    setFormData(template);
    setErrors({});
  }, []);

  const createJobDescription = useCallback(() => {
    // Helper functions
    const getEstimatedDuration = () => {
      const timeoutMinutes = parseInt(formData.timeoutMinutes);
      if (timeoutMinutes <= 60) return '30min-1hour';
      if (timeoutMinutes <= 120) return '1-2 hours';
      if (timeoutMinutes <= 240) return '2-4 hours';
      if (timeoutMinutes <= 480) return '4-8 hours';
      return '8+ hours';
    };

    const getJobRequirements = () => {
      const baseRequirements = ['Complete the task as described', 'Provide high-quality output'];
      
      switch (formData.category) {
        case 'translation':
          return [...baseRequirements, 'Native or fluent language skills', 'Accurate translation'];
        case 'writing':
          return [...baseRequirements, 'Original content', 'Proper grammar and formatting'];
        case 'design':
          return [...baseRequirements, 'High-resolution output', 'Professional quality'];
        case 'data-entry':
          return [...baseRequirements, 'Accurate data entry', 'Consistent formatting'];
        default:
          return baseRequirements;
      }
    };

    // Create a rich JSON description with metadata
    const jobMetadata = {
      task: formData.task,
      fullDescription: formData.description,
      category: formData.category,
      urgency: formData.urgency,
      estimated_duration: getEstimatedDuration(),
      reward_amount: `${formData.rewardAmount} SUI`,
      submitter_address: account?.address,
      timestamp: new Date().toISOString(),
      requirements: getJobRequirements(),
      deadline: new Date(Date.now() + parseInt(formData.timeoutMinutes) * 60 * 1000).toISOString()
    };

    return JSON.stringify(jobMetadata, null, 2);
  }, [formData, account?.address]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account?.address) {
      addToast('Please connect your wallet first', 'error');
      return;
    }

    if (!validateForm()) {
      addToast('Please fix the form errors', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const jobDescription = createJobDescription();
      const rewardAmount = parseFloat(formData.rewardAmount);
      const timeoutMinutes = parseInt(formData.timeoutMinutes);

      console.log('Submitting job with:', {
        description: jobDescription,
        rewardAmount,
        timeoutMinutes
      });

      const result = await suiJobService.submitJob(
        jobDescription,
        rewardAmount,
        timeoutMinutes,
        signAndExecuteTransaction
      );

      if (result.success) {
        addToast(`Job submitted successfully! Job ID: ${result.jobId}`, 'success');
        
        // Reset form
        setFormData({
          task: '',
          description: '',
          category: '',
          urgency: 'standard',
          rewardAmount: '0.1',
          timeoutMinutes: '60'
        });
        
        onJobSubmitted?.(result.jobId || '');
      } else {
        addToast(result.error || 'Failed to submit job', 'error');
      }
    } catch (error) {
      console.error('Error submitting job:', error);
      addToast('Unexpected error occurred while submitting job', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account?.address) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600">Please connect your SUI wallet to submit jobs to the blockchain</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Submit New Job</h2>
        <p className="text-gray-600">Create a new job on the SUI blockchain for workers to complete</p>
      </div>

      {/* Job Templates */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Quick Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Object.entries(JOB_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => applyTemplate(key as keyof typeof JOB_TEMPLATES)}
              className="text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <div className="font-medium text-blue-800 text-sm">{template.task}</div>
              <div className="text-xs text-blue-600 mt-1">{template.rewardAmount} SUI</div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Title */}
        <div>
          <label htmlFor="task" className="block text-sm font-medium text-gray-700 mb-1">
            Task Title *
          </label>
          <input
            id="task"
            type="text"
            value={formData.task}
            onChange={(e) => setFormData(prev => ({ ...prev, task: e.target.value }))}
            className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.task ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter a clear, concise task title"
          />
          {errors.task && <p className="text-red-500 text-xs mt-1">{errors.task}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
            className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Provide detailed instructions and requirements"
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
        </div>

        {/* Category and Urgency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.category ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select category</option>
              <option value="translation">Translation</option>
              <option value="writing">Writing</option>
              <option value="design">Design</option>
              <option value="data-entry">Data Entry</option>
              <option value="research">Research</option>
              <option value="programming">Programming</option>
              <option value="other">Other</option>
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          <div>
            <label htmlFor="urgency" className="block text-sm font-medium text-gray-700 mb-1">
              Urgency
            </label>
            <select
              id="urgency"
              value={formData.urgency}
              onChange={(e) => setFormData(prev => ({ ...prev, urgency: e.target.value as 'low' | 'standard' | 'high' | 'urgent' }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Reward and Timeout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rewardAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Reward Amount (SUI) *
            </label>
            <input
              id="rewardAmount"
              type="number"
              step="0.01"
              min="0"
              value={formData.rewardAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, rewardAmount: e.target.value }))}
              className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.rewardAmount ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="0.1"
            />
            {errors.rewardAmount && <p className="text-red-500 text-xs mt-1">{errors.rewardAmount}</p>}
          </div>

          <div>
            <label htmlFor="timeoutMinutes" className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (minutes) *
            </label>
            <input
              id="timeoutMinutes"
              type="number"
              min="30"
              max="2880"
              value={formData.timeoutMinutes}
              onChange={(e) => setFormData(prev => ({ ...prev, timeoutMinutes: e.target.value }))}
              className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.timeoutMinutes ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="60"
            />
            {errors.timeoutMinutes && <p className="text-red-500 text-xs mt-1">{errors.timeoutMinutes}</p>}
            <p className="text-xs text-gray-500 mt-1">30 minutes to 48 hours (2880 minutes)</p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting Job...
              </>
            ) : (
              'Submit Job to Blockchain'
            )}
          </button>
        </div>
      </form>

      {/* Wallet Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Connected Wallet:</strong> {account.address.slice(0, 10)}...{account.address.slice(-6)}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Jobs are submitted to the SUI blockchain. Gas fees apply.
        </p>
      </div>
    </div>
  );
}
