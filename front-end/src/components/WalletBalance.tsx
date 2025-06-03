'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback } from 'react';
import { formatSuiBalance } from '@/utils/suiUtils';
import { SuiNetworkUtils } from '@/utils/suiNetworkUtils';

export default function WalletBalance() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchBalance = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      console.log('🔄 Fetching wallet balance with network resilience...');
      
      // Use robust network utilities with retry and fallback
      const balanceResult = await SuiNetworkUtils.getBalance(
        suiClient,
        account.address,
        'testnet', // TODO: Get from config or context
        10000 // 10 second timeout
      );
      
      // Convert from MIST to SUI using utility function
      const formattedBalance = formatSuiBalance(balanceResult.totalBalance);
      setBalance(formattedBalance);
      
      console.log(`✅ Successfully fetched balance: ${formattedBalance} SUI`);
      
      // Reset retry count on success
      if (retryCount > 0) {
        setRetryCount(0);
      }
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Increment retry count for exponential backoff in UI
      setRetryCount(prev => prev + 1);
      
      // Show user-friendly error message
      if (errorMessage.toLowerCase().includes('failed to fetch') || 
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('timeout')) {
        setBalance('Network Error');
      } else {
        setBalance('Error');
      }
    } finally {
      setLoading(false);
    }
  }, [account?.address, suiClient, retryCount]);

  useEffect(() => {
    if (account?.address) {
      fetchBalance();
      // Set up interval to refresh balance every 30 seconds
      // Use longer interval if there have been retry attempts
      const intervalTime = retryCount > 0 ? 60000 : 30000; // 60s if errors, 30s normal
      const interval = setInterval(fetchBalance, intervalTime);
      return () => clearInterval(interval);
    } else {
      setBalance('0');
      setRetryCount(0); // Reset retry count when account changes
    }
  }, [account?.address, fetchBalance]);

  // Manual retry function for user-triggered retries
  const handleRetry = useCallback(() => {
    console.log('🔄 Manual retry triggered by user');
    fetchBalance();
  }, [fetchBalance]);

  if (!account) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
      <span className="text-sm font-medium text-blue-700">
        {loading ? (
          <span className="animate-pulse">Loading...</span>
        ) : balance === 'Network Error' ? (
          <span className="flex items-center gap-2">
            <span className="text-red-600">Network Error</span>
            <button
              onClick={handleRetry}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title="Retry fetching balance"
            >
              Retry
            </button>
          </span>
        ) : balance === 'Error' ? (
          <span className="flex items-center gap-2">
            <span className="text-red-600">Error</span>
            <button
              onClick={handleRetry}
              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              title="Retry fetching balance"
            >
              Retry
            </button>
          </span>
        ) : (
          `${parseFloat(balance).toFixed(4)} SUI`
        )}
        {retryCount > 0 && !loading && (
          <span className="ml-1 text-xs text-gray-500" title={`${retryCount} retry attempts`}>
            (retry {retryCount})
          </span>
        )}
      </span>
    </div>
  );
}
