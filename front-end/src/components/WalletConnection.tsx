'use client';

import { ConnectButton, useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback, useRef } from 'react';
import { formatSuiBalance, truncateAddress } from '@/utils/suiUtils';
import { useToast } from '@/components/ToastProvider';
import { SuiNetworkUtils } from '@/utils/suiNetworkUtils';

export default function WalletConnection() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const suiClient = useSuiClient();
  const { addToast } = useToast();
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const hasShownConnectToast = useRef(false);
  const mountedRef = useRef(true);

  // Track wallet connection state more reliably
  useEffect(() => {
    setIsConnected(!!account?.address);
  }, [account?.address]);

  const fetchBalance = useCallback(async () => {
    if (!account?.address || !mountedRef.current) return;
    
    setLoading(true);
    setComponentError(null);
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
      if (mountedRef.current) {
        setBalance(formattedBalance);
        console.log(`✅ Successfully fetched balance: ${formattedBalance} SUI`);
      }
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (mountedRef.current) {
        // Show user-friendly error message based on error type
        if (errorMessage.toLowerCase().includes('failed to fetch') || 
            errorMessage.toLowerCase().includes('network') ||
            errorMessage.toLowerCase().includes('timeout')) {
          setBalance('Network Error');
          setComponentError('Network connectivity issue - please check your connection');
        } else {
          setBalance('Error');
          setComponentError('Failed to fetch balance');
        }
        
        // Use a stable toast error message without including addToast in dependencies
        setTimeout(() => {
          if (mountedRef.current) {
            addToast('Failed to fetch wallet balance - retrying automatically...', 'error');
          }
        }, 0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, suiClient]);

  useEffect(() => {
    if (account?.address) {
      fetchBalance();
    } else {
      setBalance('0');
      hasShownConnectToast.current = false; // Reset when disconnected
    }
  }, [account?.address, fetchBalance]);

  // Separate effect for connection notification to avoid infinite loops
  useEffect(() => {
    if (account?.address && !hasShownConnectToast.current) {
      // Use setTimeout to avoid dependency issues with addToast
      setTimeout(() => {
        if (mountedRef.current) {
          addToast('Wallet connected successfully!', 'success');
        }
      }, 0);
      hasShownConnectToast.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]); // Remove addToast from dependencies

  // Cleanup effect to handle component unmounting
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleDisconnect = () => {
    disconnect();
    addToast('Wallet disconnected', 'info');
  };

  // Always render the connect button if no account - prevents disappearing button
  if (!account?.address || !isConnected) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          Connect your SUI wallet to view balance
        </div>
        <div className="flex flex-col gap-1">
          <ConnectButton />
          {componentError && (
            <div className="text-xs text-red-500">{componentError}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-md border">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">Wallet Connected</span>
        </div>
        
        <div className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Address:</span>{' '}
          <span className="font-mono">{truncateAddress(account.address)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Balance:</span>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          ) : (
            <span className="text-lg font-bold text-blue-600">
              {balance} SUI
            </span>
          )}
          <button
            onClick={fetchBalance}
            disabled={loading}
            className="ml-2 p-1 rounded hover:bg-gray-100 transition-colors"
            title="Refresh balance"
          >
            <svg 
              className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(account.address);
            addToast('Address copied to clipboard!', 'success');
          }}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Copy Address
        </button>
        
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
