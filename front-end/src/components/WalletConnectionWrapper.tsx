'use client';

import { ConnectButton } from '@mysten/dapp-kit';
import { useState, useEffect } from 'react';
import WalletConnection from './WalletConnection';
import WalletErrorBoundary from './WalletErrorBoundary';

export default function WalletConnectionWrapper() {
  const [retryCount, setRetryCount] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Reset fallback state when retryCount changes
    if (retryCount > 0) {
      setShowFallback(false);
    }
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount(count => count + 1);
    setShowFallback(false);
  };

  // Fallback UI when wallet connection fails
  const FallbackConnectButton = () => (
    <div className="flex items-center gap-4">
      <div className="text-sm text-gray-600">
        Connect your SUI wallet to continue
      </div>
      <div className="flex flex-col gap-2">
        <ConnectButton />
        <button
          onClick={handleRetry}
          className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  if (showFallback) {
    return <FallbackConnectButton />;
  }

  return (
    <WalletErrorBoundary
      fallback={
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-medium text-yellow-800">Wallet Component Error</h3>
            </div>
            <p className="text-sm text-yellow-700 mb-3">
              The wallet component encountered an error. You can still connect using the fallback button below.
            </p>
            <button
              onClick={handleRetry}
              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
            >
              Retry Wallet Component
            </button>
          </div>
          <FallbackConnectButton />
        </div>
      }
    >
      <WalletConnection key={retryCount} />
    </WalletErrorBoundary>
  );
}
