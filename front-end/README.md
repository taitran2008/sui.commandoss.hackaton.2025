# SUI Task Management System

A comprehensive task management system built for the SUI blockchain ecosystem, featuring real-time job fetching from the SUI blockchain.

## 🚀 New Features: SUI Blockchain Integration

### Real-time Job Fetching
- Fetches jobs directly from SUI blockchain using JobSubmitted events
- Supports any wallet address job lookup
- Real-time balance checking
- Automatic job status mapping (PENDING, CLAIMED, COMPLETED, VERIFIED)

### Wallet Integration
- Seamless wallet connection via @mysten/dapp-kit
- Auto-connect on page load
- Real-time balance updates
- Support for multiple SUI networks (testnet, mainnet, devnet)

### Smart Contract Integration
- Package ID: `0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383`
- Connects to job_queue module for job management
- Reads job details, timestamps, and status directly from blockchain
- SUI Explorer integration for transaction viewing

## 🛠️ Technical Implementation

### Core Components
- **SuiJobService**: Service layer for blockchain interactions
- **useSuiJobs**: React hook for job state management
- **TaskList**: Updated UI component with SUI integration
- **SuiJobDemo**: Demo component showcasing integration features

### Key Files
- `src/lib/suiJobService.ts` - Main service for SUI blockchain interactions
- `src/hooks/useSuiJobs.ts` - React hook for job management
- `src/components/TaskList.tsx` - Updated UI with SUI integration
- `src/components/SuiJobDemo.tsx` - Demo and testing component

## 📋 Features

### Job Management
- ✅ Real-time job fetching from SUI blockchain
- ✅ Job status tracking (PENDING → CLAIMED → COMPLETED → VERIFIED)
- ✅ Reward amount display in SUI tokens
- ✅ Job timestamp tracking (created, claimed, completed)
- ✅ Worker assignment tracking

### UI Features
- ✅ Automatic wallet connection
- ✅ Real-time balance display
- ✅ Job filtering and sorting
- ✅ SUI Explorer integration
- ✅ Error handling and loading states
- ✅ Auto-refresh every 30 seconds

### Development Features
- ✅ TypeScript support
- ✅ Error boundary handling
- ✅ Responsive design with Tailwind CSS
- ✅ Toast notifications
- ✅ Demo component for testing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- SUI Wallet (Sui Wallet extension)
- Access to SUI testnet

### Installation
```bash
npm install
```

### Environment Setup
No additional environment variables required. The app connects to SUI testnet by default.

### Development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Testing SUI Integration
1. Connect your SUI wallet
2. Use the demo component to test job fetching
3. Try the sample Alice address: `0x5c4b98a5c0a15e5f3b77a3f2f80b8c4f2d9a7e1b8c6d4f2a9e5c7b3d8f1a6e4c2`

## 🔧 Configuration

### SUI Network Configuration
```typescript
// src/config/app.ts
export const APP_CONFIG = {
  sui: {
    network: 'testnet', // 'mainnet' | 'testnet' | 'devnet'
    // ... other config
  }
}
```

### Smart Contract Constants
```typescript
// src/lib/suiJobService.ts
const PACKAGE_ID = '0xb1ce95fa4ef1871449e1d474ff8c8986143e2f6f928a51a2ddef41833f0d4383';
const MANAGER_ID = '0x24f08c6063eae6e3803b3e4bd474f902104a8e0878a76bbd20b1e391a6487458';
```

## 📚 API Reference

### SuiJobService
```typescript
// Fetch jobs for a wallet
const jobs = await suiJobService.fetchJobsForWallet(walletAddress);

// Get job details
const details = await suiJobService.getJobDetails(jobId);

// Check SUI balance
const balance = await suiJobService.getSuiBalance(address);
```

### useSuiJobs Hook
```typescript
const { 
  tasks,        // Job array in Task format
  loading,      // Loading state
  error,        // Error message
  refetch,      // Manual refresh function
  balance,      // Wallet SUI balance
  isConnected   // Wallet connection status
} = useSuiJobs();
```

## 🔍 Troubleshooting

### Common Issues
1. **Wallet not connecting**: Ensure SUI Wallet extension is installed and enabled
2. **No jobs found**: Verify the wallet address has submitted jobs to the smart contract
3. **Network errors**: Check SUI testnet connectivity
4. **TypeScript errors**: Run `npm run type-check` to identify issues

### Debug Mode
Use the SuiJobDemo component to test specific wallet addresses and debug blockchain connectivity.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the demo component
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
