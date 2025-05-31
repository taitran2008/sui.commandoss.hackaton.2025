'use client'

import { 
  ConnectButton, 
  useCurrentAccount, 
  useSuiClient,
  useDisconnectWallet 
} from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'

export function WalletConnection() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutate: disconnect } = useDisconnectWallet()
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    if (!account?.address) {
      setBalance(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      console.log('Fetching balance for address:', account.address)
      const balanceResult = await suiClient.getBalance({
        owner: account.address,
        coinType: '0x2::sui::SUI'
      })
      
      console.log('Balance result:', balanceResult)
      
      // Convert from MIST (smallest unit) to SUI (1 SUI = 1e9 MIST)
      const formattedBalance = (parseInt(balanceResult.totalBalance) / 1e9).toString()
      setBalance(parseFloat(formattedBalance).toFixed(4))
    } catch (error) {
      console.error('Error fetching balance:', error)
      setError('Failed to fetch balance')
      setBalance('Error')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch balance when account changes
  useEffect(() => {
    console.log('Account changed:', account?.address)
    fetchBalance()
  }, [account?.address])

  // Set up auto-refresh every 15 seconds
  useEffect(() => {
    if (!account?.address) return

    const interval = setInterval(() => {
      console.log('Auto-refreshing balance...')
      fetchBalance()
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [account?.address])

  // Debug logging
  useEffect(() => {
    console.log('WalletConnection component rendered')
    console.log('Current account:', account)
  }, [account])

  if (!account) {
    return (
      <div className="wallet-connection">
        <div className="wallet-card">
          <h3 className="wallet-title">Connect to SUI Testnet</h3>
          <p className="wallet-description">
            Connect your wallet to interact with the SUI testnet
          </p>
          <div style={{ margin: '1rem 0' }}>
            <ConnectButton 
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            />
          </div>
          {error && (
            <div style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Error: {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="wallet-connection">
      <div className="wallet-card connected">
        <div className="wallet-header">
          <h3 className="wallet-title">Wallet Connected</h3>
          <button 
            onClick={() => disconnect()}
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
        
        <div className="wallet-info">
          <div className="address-section">
            <span className="label">Address:</span>
            <span className="address">
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </span>
          </div>
          
          <div className="balance-section">
            <span className="label">SUI Balance:</span>
            <div className="balance-display">
              {isLoading ? (
                <span className="loading">Refreshing...</span>
              ) : (
                <span className="balance">{balance || '0'} SUI</span>
              )}
            </div>
          </div>
          
          <button 
            onClick={fetchBalance}
            disabled={isLoading}
            className="refresh-button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Balance'}
          </button>
        </div>
        
        <div className="auto-refresh-info">
          <small>Balance auto-refreshes every 15 seconds</small>
        </div>
      </div>
    </div>
  )
}