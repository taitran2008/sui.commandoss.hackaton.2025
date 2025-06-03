'use client';

import { useState } from 'react';
import { truncateAddress } from '@/utils/suiUtils';

interface AddressDisplayProps {
  address: string;
  className?: string;
  showCopyButton?: boolean;
}

export default function AddressDisplay({ 
  address, 
  className = '', 
  showCopyButton = false 
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span 
        className="font-mono text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
        title={address}
        onClick={showCopyButton ? copyToClipboard : undefined}
      >
        {truncateAddress(address)}
      </span>
      
      {showCopyButton && (
        <button
          onClick={copyToClipboard}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          title={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
