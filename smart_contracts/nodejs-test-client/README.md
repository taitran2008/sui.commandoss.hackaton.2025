# Job Queue Smart Contract Test Client

This Node.js project provides a simple test client for interacting with the Job Queue Smart Contract deployed on Sui Testnet.

## Features

- ✅ Creates a new Sui wallet automatically
- ✅ Requests testnet SUI tokens from faucet
- ✅ Submits a job with custom payload to the queue
- ✅ Retrieves the job and displays the payload
- ✅ Shows transaction details and explorer links

## Contract Information

- **Network**: Sui Testnet
- **Package ID**: `0x43d4e4b6cf4ec60b53a540f20b1d38ffadef990ecb1a66044602157d4acb6df8`
- **JobQueueManager Object ID**: `0xcb115e925c3f5f2935b9e91b8cd53a300621af0ee5651f6d49827d48ff614a35`

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the simple test:**
   ```bash
   npm test
   # or
   npm start
   ```

3. **Run the full test suite:**
   ```bash
   npm run test-full
   ```

4. **Test with persistent wallet management:**
   ```bash
   npm run test-wallet
   ```

## Wallet Management

### Create a new wallet:
```bash
npm run wallet:create
```
This generates a new Sui wallet and saves it to a file named with the public address.

### List all saved wallets:
```bash
npm run wallet:list
```

### Use an existing wallet for testing:
```bash
node test-with-saved-wallet.js 0x[YOUR_WALLET_ADDRESS]
```

### Delete a wallet file:
```bash
npm run wallet:delete 0x[YOUR_WALLET_ADDRESS]
```

## What the Test Does

The test performs the following steps:

1. **Creates a New Wallet**: Generates a new mnemonic phrase and Sui address
2. **Requests Testnet Funds**: Automatically gets SUI tokens from the testnet faucet
3. **Submits a Job**: Creates a test job with a sample image processing payload
4. **Retrieves the Job**: Fetches the job data back from the blockchain
5. **Displays Results**: Shows the payload and transaction details

## Sample Output

```
🔑 Creating new wallet...
📋 Mnemonic: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
🏠 Address: 0x1234567890abcdef1234567890abcdef12345678
⚠️  Save this mnemonic securely!

💰 Requesting testnet SUI tokens...
✅ Testnet funds requested successfully
⏳ Waiting 5 seconds for funds to arrive...

💵 Current balance: 10 SUI

📝 Submitting job...
   Job ID: test-job-1704067200000
   Queue: test-queue
   Payload: {
     "task": "image_processing",
     "image_url": "https://example.com/test-image.jpg",
     "operations": ["resize", "compress", "convert_to_webp"],
     "target_size": { "width": 800, "height": 600 },
     "quality": 85,
     "timestamp": "2025-01-01T12:00:00.000Z"
   }

✅ Job submitted successfully!
   Transaction: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

📊 Job Submission Event:
   UUID: test-job-1704067200000
   Queue: test-queue
   Submitter: 0x1234567890abcdef1234567890abcdef12345678
   Priority Stake: 1000000000 MIST
   Created At: 2025-01-01T12:00:00.000Z

⏳ Waiting 3 seconds before retrieving job payload...

🔍 Retrieving job and displaying payload...
✅ Job retrieved successfully!
📦 Job Payload Retrieved:
{
  "task": "image_processing",
  "image_url": "https://example.com/test-image.jpg",
  "operations": ["resize", "compress", "convert_to_webp"],
  "target_size": { "width": 800, "height": 600 },
  "quality": 85,
  "timestamp": "2025-01-01T12:00:00.000Z"
}

🔗 Transaction Details:
   View on Explorer: https://testnet.suivision.xyz/txblock/0xabcdef...
   Package: https://testnet.suivision.xyz/package/0x43d4e4b6cf4ec60b53a540f20b1d38ffadef990ecb1a66044602157d4acb6df8

✅ Test completed! Your job with payload has been successfully added to the blockchain.
💡 The job payload is now stored on-chain and can be retrieved by workers or other clients.
```

## File Structure

```
nodejs-test-client/
├── package.json          # Project configuration
├── simple-test.js        # Simple test script (main)
├── test-job-queue.js     # Full-featured test client
└── README.md            # This file
```

## Scripts

- `npm test` / `npm start`: Run the simple test that creates wallet, submits job, and retrieves payload
- `npm run test-full`: Run the comprehensive test with additional features like queue stats and treasury balance

## Important Notes

1. **Save Your Mnemonic**: The test creates a new wallet each time. Save the mnemonic phrase if you want to reuse the wallet.

2. **Testnet Only**: This is configured for Sui Testnet. Do not use real funds.

3. **Automatic Faucet**: The script automatically requests testnet funds, but if it fails, you can manually use the faucet:
   - URL: https://faucet.testnet.sui.io/
   - Use the generated address from the console output

4. **Transaction Costs**: Each job submission costs gas plus the stake amount (1 SUI by default).

## Customization

You can modify the payload in `simple-test.js` to test different job types:

```javascript
const payload = {
    task: 'your_custom_task',
    data: 'your_custom_data',
    // ... other fields
};
```

## Troubleshooting

- **No funds**: If the faucet fails, manually request funds from https://faucet.testnet.sui.io/
- **Network issues**: Ensure you have internet connection for Sui Testnet RPC calls
- **Transaction failures**: Check the console output for detailed error messages

## Next Steps

- Implement a worker to process jobs from the queue
- Add job completion and failure handling
- Integrate with your application's job processing logic
- Set up monitoring for queue statistics and treasury balance
