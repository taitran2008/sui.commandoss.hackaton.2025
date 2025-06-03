'use client';

import { Task } from '@/types/task';
import { useState } from 'react';
import { suiJobService } from '@/lib/suiJobService';
import AddressDisplay from './AddressDisplay';

interface TaskCardProps {
  task: Task;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (uuid: string) => void;
}

export default function TaskCard({ task, onTaskUpdated }: TaskCardProps) {
  const [isUpdating] = useState(false);

  // For SUI blockchain jobs, we'll disable direct updates and deletions
  // These would require blockchain transactions
  const handleViewOnExplorer = () => {
    // Open SUI explorer with the job ID using the service
    const explorerUrl = suiJobService.getExplorerUrl(task.uuid, 'object');
    window.open(explorerUrl, '_blank');
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
      task.completed ? 'border-green-500 bg-gray-50' : 'border-blue-500'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-lg font-semibold ${task.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
              {task.task}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(task.urgency)}`}>
              {task.urgency}
            </span>
            {task.completed && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Completed
              </span>
            )}
          </div>
          
          <p className={`text-sm mb-3 ${task.completed ? 'text-gray-400' : 'text-gray-600'}`}>
            {task.description}
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Category:</span> {task.category}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {task.estimated_duration}
            </div>
            <div>
              <span className="font-medium">Reward:</span> {task.reward_amount} SUI
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
        </div>
        
        <div className="text-xs text-gray-500">
          On SUI Blockchain
        </div>
      </div>
    </div>
  );
}
