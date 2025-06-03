'use client';

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useState, useEffect, useCallback } from 'react';
import { truncateAddress } from '@/utils/suiUtils';
import { useToast } from '@/components/ToastProvider';

interface TransactionSummary {
  digest: string;
  timestamp: number;
  sender: string;
  gasUsed: string;
  status: 'success' | 'failure';
}

export default function TransactionHistory() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchTransactionHistory = useCallback(async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      // Get recent transactions for the connected address
      const txResponse = await suiClient.queryTransactionBlocks({
        filter: {
          FromAddress: account.address,
        },
        limit: 5,
        order: 'descending',
      });

      const txSummaries: TransactionSummary[] = await Promise.all(
        txResponse.data.map(async (tx) => {
          try {
            const details = await suiClient.getTransactionBlock({
              digest: tx.digest,
              options: {
                showEffects: true,
                showInput: true,
              },
            });

            return {
              digest: tx.digest,
              timestamp: parseInt(tx.timestampMs || '0'),
              sender: details.transaction?.data?.sender || '',
              gasUsed: details.effects?.gasUsed?.computationCost || '0',
              status: details.effects?.status?.status === 'success' ? 'success' : 'failure',
            };
          } catch (error) {
            console.error('Error fetching transaction details:', error);
            return {
              digest: tx.digest,
              timestamp: parseInt(tx.timestampMs || '0'),
              sender: account.address,
              gasUsed: '0',
              status: 'success' as const,
            };
          }
        })
      );

      setTransactions(txSummaries);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      // Use setTimeout to avoid addToast dependency
      setTimeout(() => {
        addToast('Failed to fetch transaction history', 'error');
      }, 0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, suiClient]); // Remove addToast from dependencies

  useEffect(() => {
    if (account?.address && expanded) {
      fetchTransactionHistory();
    }
  }, [account?.address, expanded, fetchTransactionHistory]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const openInExplorer = (digest: string) => {
    // Open in SUI Explorer (mainnet)
    window.open(`https://suiexplorer.com/txblock/${digest}`, '_blank');
  };

  if (!account) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-medium text-gray-900">Transaction History</span>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transform transition-transform ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No recent transactions found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {transactions.map((tx) => (
                <div key={tx.digest} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="font-mono text-sm">
                        {truncateAddress(tx.digest, 8, 8)}
                      </span>
                    </div>
                    <button
                      onClick={() => openInExplorer(tx.digest)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View in Explorer
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Time: {formatTimestamp(tx.timestamp)}</div>
                    <div>Gas Used: {tx.gasUsed} MIST</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
