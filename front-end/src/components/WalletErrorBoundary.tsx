'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Wallet Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-medium text-red-800">Wallet Connection Error</h3>
          </div>
          <p className="text-sm text-red-700 mb-3">
            There was an error with the wallet component. Please try the following:
          </p>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-1 mb-3">
            <li>Make sure you have a SUI wallet extension installed (Sui Wallet, Martian, etc.)</li>
            <li>Check that your wallet is unlocked and connected to the correct network</li>
            <li>Try refreshing the page</li>
            <li>Clear your browser cache and cookies</li>
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
          {this.state.error && (
            <details className="mt-3">
              <summary className="text-xs text-red-600 cursor-pointer">Show error details</summary>
              <pre className="text-xs text-red-600 mt-1 p-2 bg-red-100 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
