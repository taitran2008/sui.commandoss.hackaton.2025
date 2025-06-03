'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback } from 'react';
import { SuiNetworkUtils } from '@/utils/suiNetworkUtils';

export default function WalletStatus() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [networkInfo, setNetworkInfo] = useState<{
    version?: string;
    isConnected: boolean;
    latency?: number;
    endpoint?: string;
  }>({ isConnected: false });
  const [retryCount, setRetryCount] = useState(0);

  const checkNetworkConnection = useCallback(async () => {
    try {
      console.log('🔄 Checking network connection with resilience...');
      
      // Use health check for better network status detection
      const healthCheck = await SuiNetworkUtils.healthCheck(suiClient, 'testnet');
      
      if (healthCheck.healthy) {
        // Get chain identifier if healthy
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getChainIdentifier timeout')), 5000)
        );
        
        const chainId = await Promise.race([
          suiClient.getChainIdentifier(),
          timeoutPromise
        ]) as string;
        
        setNetworkInfo({
          version: chainId,
          isConnected: true,
          latency: healthCheck.latency,
          endpoint: healthCheck.endpoint
        });
        
        console.log(`✅ Network connected: ${chainId} (${healthCheck.latency}ms)`);
        
        // Reset retry count on success
        if (retryCount > 0) {
          setRetryCount(0);
        }
      } else {
        throw new Error('Network health check failed');
      }
    } catch (error) {
      console.error('❌ Error checking network connection:', error);
      setNetworkInfo({ isConnected: false });
      setRetryCount(prev => prev + 1);
    }
  }, [suiClient, retryCount]);

  useEffect(() => {
    if (account?.address) {
      checkNetworkConnection();
      // Check periodically, less frequently if there are errors
      const intervalTime = retryCount > 0 ? 30000 : 15000; // 30s if errors, 15s normal
      const interval = setInterval(checkNetworkConnection, intervalTime);
      return () => clearInterval(interval);
    } else {
      setNetworkInfo({ isConnected: false });
      setRetryCount(0);
    }
  }, [account?.address, checkNetworkConnection]);

  const handleRetry = useCallback(() => {
    console.log('🔄 Manual network status retry triggered by user');
    checkNetworkConnection();
  }, [checkNetworkConnection]);

  const getStatusColor = () => {
    if (!account) return 'bg-gray-400';
    if (networkInfo.isConnected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (!account) return 'Disconnected';
    if (networkInfo.isConnected) return 'Connected';
    return 'Connection Failed';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-gray-600">{getStatusText()}</span>
        {!networkInfo.isConnected && account && (
          <button
            onClick={handleRetry}
            className="ml-1 px-1 py-0.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
            title="Retry network connection"
          >
            Retry
          </button>
        )}
      </div>
      {networkInfo.version && (
        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded" title={`Latency: ${networkInfo.latency}ms via ${networkInfo.endpoint}`}>
          {networkInfo.version}
        </span>
      )}
      {retryCount > 0 && (
        <span className="text-xs text-gray-400" title={`${retryCount} retry attempts`}>
          (retry {retryCount})
        </span>
      )}
    </div>
  );
}
