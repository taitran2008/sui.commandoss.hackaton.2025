'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback } from 'react';
import { formatSuiBalance } from '@/utils/suiUtils';

export default function WalletBalance() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      const balance = await suiClient.getBalance({
        owner: account.address,
      });
      
      // Convert from MIST to SUI using utility function
      const formattedBalance = formatSuiBalance(balance.totalBalance);
      setBalance(formattedBalance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance('Error');
    } finally {
      setLoading(false);
    }
  }, [account?.address, suiClient]);

  useEffect(() => {
    if (account?.address) {
      fetchBalance();
      // Set up interval to refresh balance every 30 seconds
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    } else {
      setBalance('0');
    }
  }, [account?.address, fetchBalance]);

  if (!account) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
      <span className="text-sm font-medium text-blue-700">
        {loading ? (
          <span className="animate-pulse">Loading...</span>
        ) : (
          `${parseFloat(balance).toFixed(4)} SUI`
        )}
      </span>
    </div>
  );
}
