const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const fs = require('fs');
const path = require('path');

class WalletGenerator {
    static generateWallet() {
        console.log('🔑 Generating new Sui wallet...');
        
        // Generate new keypair (random)
        const keypair = new Ed25519Keypair();
        
        // Get public address
        const publicAddress = keypair.getPublicKey().toSuiAddress();
        
        // Get the Sui private key string (70 bytes)
        const suiPrivateKeyString = keypair.getSecretKey();
        
        // Extract the raw 32-byte secret key from the Sui private key string
        // Sui private key format: suiprivkey1q... (base58 encoded)
        // We need to decode it to get the raw 32-byte secret key
        const { decodeSuiPrivateKey } = require('@mysten/sui/cryptography');
        const { secretKey: raw32ByteKey } = decodeSuiPrivateKey(suiPrivateKeyString);
        
        // Convert raw 32-byte secret key to base64 for storage
        const privateKeyBase64 = Buffer.from(raw32ByteKey).toString('base64');
        
        console.log('🏠 Public Address:', publicAddress);
        console.log('🔐 Private Key (32-byte Base64):', privateKeyBase64);
        console.log('📏 Key length:', raw32ByteKey.length, 'bytes');
        
        return {
            publicAddress,
            privateKey: privateKeyBase64,
            keypair
        };
    }
    
    static saveWalletToFile(walletData) {
        const { publicAddress, privateKey } = walletData;
        
        // Create wallets directory if it doesn't exist
        const walletsDir = path.join(__dirname, 'wallets');
        if (!fs.existsSync(walletsDir)) {
            fs.mkdirSync(walletsDir, { recursive: true });
        }
        
        // Create filename using public address (without extension)
        const filename = publicAddress;
        const filepath = path.join(walletsDir, filename);
        
        try {
            // Save only the secret key to file
            fs.writeFileSync(filepath, privateKey);
            console.log('💾 Wallet saved to:', `wallets/${filename}`);
            console.log('📁 Full path:', filepath);
            
            return filepath;
        } catch (error) {
            console.error('❌ Error saving wallet file:', error.message);
            throw error;
        }
    }
    
    static loadWalletFromFile(publicAddress) {
        const walletsDir = path.join(__dirname, 'wallets');
        const filepath = path.join(walletsDir, publicAddress);
        
        try {
            if (!fs.existsSync(filepath)) {
                throw new Error(`Wallet file not found: ${publicAddress}`);
            }
            
            // Read the content from file
            const fileContent = fs.readFileSync(filepath, 'utf8').trim();
            console.log('📖 Loaded wallet:', publicAddress);
            
            let keypair;
            let privateKey = fileContent;
            
            // Decode base64 content first
            const decodedData = Buffer.from(fileContent, 'base64');
            
            if (decodedData.length === 32) {
                // New format: Raw 32-byte secret key stored as base64
                console.log('🔑 Detected 32-byte secret key format');
                keypair = Ed25519Keypair.fromSecretKey(decodedData);
            } else {
                // Old format: Sui private key string stored as base64
                const decodedString = decodedData.toString('utf8');
                if (decodedString.startsWith('suiprivkey1')) {
                    console.log('🔑 Detected Sui private key string format');
                    keypair = Ed25519Keypair.fromSecretKey(decodedString);
                    privateKey = decodedString;
                } else {
                    throw new Error(`Unknown private key format. Decoded length: ${decodedData.length} bytes`);
                }
            }
            
            // Verify the address matches
            const derivedAddress = keypair.getPublicKey().toSuiAddress();
            if (derivedAddress !== publicAddress) {
                console.log(`⚠️ Address mismatch: expected ${publicAddress}, got ${derivedAddress}`);
                console.log('🔧 Using derived address for consistency');
            }
            
            return {
                publicAddress: derivedAddress, // Use the derived address to ensure consistency
                privateKey,
                keypair
            };
        } catch (error) {
            console.error('❌ Error loading wallet file:', error.message);
            throw error;
        }
    }
    
    static listWalletFiles() {
        try {
            const walletsDir = path.join(__dirname, 'wallets');
            if (!fs.existsSync(walletsDir)) {
                console.log('💼 No wallets directory found');
                return [];
            }
            
            const files = fs.readdirSync(walletsDir);
            const walletFiles = files.filter(file => file.startsWith('0x'));
            
            console.log('💼 Available wallet files:');
            walletFiles.forEach(file => {
                console.log(`   📄 ${file}`);
            });
            
            return walletFiles;
        } catch (error) {
            console.error('❌ Error listing wallet files:', error.message);
            return [];
        }
    }
    
    static deleteWalletFile(publicAddress) {
        const walletsDir = path.join(__dirname, 'wallets');
        const filepath = path.join(walletsDir, publicAddress);
        
        try {
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log('🗑️  Deleted wallet file:', publicAddress);
                return true;
            } else {
                console.log('❌ Wallet file not found:', publicAddress);
                return false;
            }
        } catch (error) {
            console.error('❌ Error deleting wallet file:', error.message);
            throw error;
        }
    }
}

// Main function for CLI usage
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'create':
        case 'new':
            console.log('🚀 Creating new Sui wallet...\n');
            const walletData = WalletGenerator.generateWallet();
            const filepath = WalletGenerator.saveWalletToFile(walletData);
            console.log('\n✅ Wallet created successfully!');
            console.log('⚠️  Please keep your private key safe!');
            console.log('💡 You can load this wallet later using the public address.');
            break;
            
        case 'load':
            const address = args[1];
            if (!address) {
                console.log('❌ Please provide a public address to load');
                console.log('Usage: node create-wallet.js load <public_address>');
                return;
            }
            console.log('📖 Loading wallet...\n');
            const loadedWallet = WalletGenerator.loadWalletFromFile(address);
            console.log('✅ Wallet loaded successfully!');
            break;
            
        case 'list':
            console.log('📋 Listing available wallets...\n');
            WalletGenerator.listWalletFiles();
            break;
            
        case 'delete':
            const addressToDelete = args[1];
            if (!addressToDelete) {
                console.log('❌ Please provide a public address to delete');
                console.log('Usage: node create-wallet.js delete <public_address>');
                return;
            }
            console.log('🗑️  Deleting wallet...\n');
            WalletGenerator.deleteWalletFile(addressToDelete);
            break;
            
        default:
            console.log('🔑 Sui Wallet Generator\n');
            console.log('Available commands:');
            console.log('  create/new  - Generate a new wallet');
            console.log('  load <addr> - Load an existing wallet');
            console.log('  list        - List all wallet files');
            console.log('  delete <addr> - Delete a wallet file');
            console.log('\nExamples:');
            console.log('  node create-wallet.js create');
            console.log('  node create-wallet.js load 0x1234...');
            console.log('  node create-wallet.js list');
            console.log('  node create-wallet.js delete 0x1234...');
            break;
    }
}

// Export for use as module
module.exports = { WalletGenerator };

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
