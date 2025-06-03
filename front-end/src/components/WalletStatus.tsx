'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback } from 'react';

export default function WalletStatus() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [networkInfo, setNetworkInfo] = useState<{
    version?: string;
    isConnected: boolean;
  }>({ isConnected: false });

  const checkNetworkConnection = useCallback(async () => {
    try {
      // Try to get chain identifier to verify connection
      const chainId = await suiClient.getChainIdentifier();
      setNetworkInfo({
        version: chainId,
        isConnected: true
      });
    } catch (error) {
      console.error('Error checking network connection:', error);
      setNetworkInfo({ isConnected: false });
    }
  }, [suiClient]);

  useEffect(() => {
    if (account?.address) {
      checkNetworkConnection();
    } else {
      setNetworkInfo({ isConnected: false });
    }
  }, [account?.address, checkNetworkConnection]);

  const getStatusColor = () => {
    if (!account) return 'bg-gray-400';
    if (networkInfo.isConnected) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (!account) return 'Disconnected';
    if (networkInfo.isConnected) return 'Connected';
    return 'Connecting...';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-gray-600">{getStatusText()}</span>
      </div>
      {networkInfo.version && (
        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
          {networkInfo.version}
        </span>
      )}
    </div>
  );
}
