/**
 * React hook for fetching and managing SUI jobs
 * Integrates with @mysten/dapp-kit for wallet connection
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Task } from '@/types/task';
import { suiJobService } from '@/lib/suiJobService';

export interface UseSuiJobsReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  balance: number;
  isConnected: boolean;
  currentAddress: string | null;
}

export function useSuiJobs(hostAddress?: string | null): UseSuiJobsReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  
  const currentAccount = useCurrentAccount();
  const isConnected = !!currentAccount;
  
  // Use host address if provided, otherwise use connected wallet address
  const targetAddress = hostAddress || currentAccount?.address;
  const currentAddress = targetAddress || null;

  const fetchJobs = useCallback(async () => {
    if (!targetAddress) {
      setTasks([]);
      setBalance(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch both jobs and balance in parallel
      const [jobTasks, walletBalance] = await Promise.all([
        suiJobService.fetchJobsForWallet(targetAddress),
        suiJobService.getSuiBalance(targetAddress)
      ]);

      setTasks(jobTasks);
      setBalance(walletBalance);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch jobs';
      setError(errorMessage);
      console.error('Error fetching SUI jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [targetAddress]);

  // Fetch jobs when wallet connects/disconnects
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh jobs every 30 seconds when we have a target address
  useEffect(() => {
    if (!targetAddress) return;

    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [targetAddress, fetchJobs]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchJobs,
    balance,
    isConnected,
    currentAddress
  };
}
