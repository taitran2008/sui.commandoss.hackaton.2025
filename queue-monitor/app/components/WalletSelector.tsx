'use client'

import { useState, useEffect } from 'react'
import { WalletJobList } from './WalletJobList'

// Default test wallets for demonstration
const TEST_WALLETS = {
  Alice: '',
  Bob: '',
  Carol: ''
}

export function WalletSelector() {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [customWallet, setCustomWallet] = useState('')
  
  // Load test wallets from localStorage if available
  useEffect(() => {
    try {
      const savedWallets = localStorage.getItem('testWallets')
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets)
        if (parsed.Alice) TEST_WALLETS.Alice = parsed.Alice
        if (parsed.Bob) TEST_WALLETS.Bob = parsed.Bob
        if (parsed.Carol) TEST_WALLETS.Carol = parsed.Carol
      }
    } catch (e) {
      console.error('Failed to load test wallets from localStorage', e)
    }
  }, [])

  // Save test wallets to localStorage
  const saveWallets = () => {
    try {
      localStorage.setItem('testWallets', JSON.stringify(TEST_WALLETS))
    } catch (e) {
      console.error('Failed to save test wallets to localStorage', e)
    }
  }

  // Handle selecting a predefined wallet
  const selectWallet = (name: keyof typeof TEST_WALLETS) => {
    setSelectedWallet(TEST_WALLETS[name] || null)
  }

  // Handle updating a wallet address
  const updateWalletAddress = (name: keyof typeof TEST_WALLETS, address: string) => {
    TEST_WALLETS[name] = address
    saveWallets()
  }

  // Handle viewing custom wallet
  const viewCustomWallet = () => {
    if (customWallet.trim()) {
      setSelectedWallet(customWallet.trim())
    }
  }

  return (
    <div className="wallet-selector">
      <div className="space-y-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <h3 className="text-lg font-semibold text-blue-800">Test Wallet Selector</h3>
        
        {/* Predefined wallets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(TEST_WALLETS) as Array<keyof typeof TEST_WALLETS>).map((name) => (
            <div key={name} className="flex flex-col">
              <div className="flex items-center mb-1">
                <span className="font-medium text-gray-700 mr-2">{name}:</span>
                <button
                  onClick={() => selectWallet(name)}
                  disabled={!TEST_WALLETS[name]}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
                >
                  View Jobs
                </button>
              </div>
              <input
                type="text"
                placeholder={`Enter ${name}'s address`}
                value={TEST_WALLETS[name]}
                onChange={(e) => updateWalletAddress(name, e.target.value)}
                className="border rounded p-2 text-sm font-mono"
              />
            </div>
          ))}
        </div>

        {/* Custom wallet input */}
        <div className="pt-2 border-t border-blue-200">
          <div className="flex items-center">
            <input
              type="text"
              placeholder="Enter custom wallet address"
              value={customWallet}
              onChange={(e) => setCustomWallet(e.target.value)}
              className="flex-1 border rounded p-2 text-sm font-mono"
            />
            <button
              onClick={viewCustomWallet}
              disabled={!customWallet.trim()}
              className="ml-2 px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-300"
            >
              View Jobs
            </button>
          </div>
        </div>
        
        {/* Status indicator */}
        {selectedWallet && (
          <div className="mt-2 text-sm text-blue-700">
            Viewing jobs for: <span className="font-mono">{selectedWallet.slice(0, 10)}...{selectedWallet.slice(-6)}</span>
            <button
              onClick={() => setSelectedWallet(null)}
              className="ml-2 text-xs underline text-blue-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Jobs List */}
      {selectedWallet ? (
        <WalletJobList walletAddress={selectedWallet} refreshInterval={30000} />
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600">Select a wallet or connect your own wallet to view jobs</p>
        </div>
      )}
    </div>
  )
}
