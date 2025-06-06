/**
 * SUI Smart Contract Configuration
 * Update these addresses when deploying to different networks or contracts
 */

interface NetworkConfig {
  rpcUrl: string;
  explorerUrl: string;
  fallbackUrls?: string[];
}

export const SUI_CONTRACT_CONFIG = {
  // Smart Contract Addresses
  PACKAGE_ID: '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383',
  MANAGER_ID: '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458',
  CLOCK_ID: '0x6',
  
  // Network Configuration
  networks: {
    mainnet: {
      rpcUrl: 'https://fullnode.mainnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
      fallbackUrls: [
        'https://sui-mainnet-endpoint.blockvision.org',
        'https://mainnet.suiet.app'
      ]
    } as NetworkConfig,
    testnet: {
      rpcUrl: 'https://fullnode.testnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
      fallbackUrls: [
        'https://sui-testnet-endpoint.blockvision.org',
        'https://sui-testnet.nodeinfra.com',
        'https://testnet.suiet.app'
      ]
    } as NetworkConfig,
    devnet: {
      rpcUrl: 'https://fullnode.devnet.sui.io:443',
      explorerUrl: 'https://suiscan.xyz/',
      fallbackUrls: [
        'https://sui-devnet-endpoint.blockvision.org'
      ]
    } as NetworkConfig,
  },
  
  // Default Settings
  defaults: {
    QUERY_LIMIT: 50,
    REFRESH_INTERVAL: 30000, // 30 seconds
    GAS_BUDGET: 1000000000, // 1 SUI
  },
} as const;

export type SuiNetwork = keyof typeof SUI_CONTRACT_CONFIG.networks;
