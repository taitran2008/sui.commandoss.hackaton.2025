/**
 * SUI Network Utilities - Robust network operations for Sui client
 * 
 * This utility provides network-resilient operations for common Sui client calls
 * with retry logic, timeout handling, and fallback mechanisms.
 */

import { SuiClient } from '@mysten/sui/client';
import { SUI_CONTRACT_CONFIG, SuiNetwork } from '@/config/sui-config';

export class SuiNetworkUtils {
  private static fallbackClients: Map<SuiNetwork, SuiClient> = new Map();

  /**
   * Retry wrapper with exponential backoff for network requests
   */
  private static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();
        
        // Check if it's a network/fetch error that we should retry
        const isRetryableError = errorMessage.includes('failed to fetch') ||
                                errorMessage.includes('network error') ||
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('429') ||
                                errorMessage.includes('too many requests') ||
                                errorMessage.includes('connection') ||
                                errorMessage.includes('fetch') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('econnreset') ||
                                errorMessage.includes('abort');

        if (!isRetryableError || attempt >= maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const jitter = Math.random() * 500; // Add 0-500ms jitter
        const delay = initialDelay * Math.pow(2, attempt) + jitter;
        
        console.warn(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms. Error: ${errorMessage}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Initialize a fallback client for the given network
   */
  private static async initializeFallbackClient(network: SuiNetwork): Promise<SuiClient> {
    const networkConfig = SUI_CONTRACT_CONFIG.networks[network] as {
      rpcUrl: string;
      explorerUrl: string;
      fallbackUrls?: string[];
    };

    const fallbackUrls = [
      networkConfig.rpcUrl, // Try primary again
      ...(networkConfig.fallbackUrls || [])
    ];

    for (const url of fallbackUrls) {
      try {
        console.log(`🔄 Trying to connect to: ${url}`);
        const testClient = new SuiClient({ url });
        
        // Test connectivity with a timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        await Promise.race([
          testClient.getLatestSuiSystemState(),
          timeoutPromise
        ]);
        
        console.log(`✅ Successfully connected to fallback: ${url}`);
        this.fallbackClients.set(network, testClient);
        return testClient;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`❌ Failed to connect to ${url}: ${errorMessage}`);
        continue;
      }
    }
    
    throw new Error('All RPC endpoints are unreachable for network: ' + network);
  }

  /**
   * Get a fallback client for the given network, creating one if needed
   */
  private static async getFallbackClient(network: SuiNetwork): Promise<SuiClient> {
    const existingClient = this.fallbackClients.get(network);
    if (existingClient) {
      return existingClient;
    }
    
    return await this.initializeFallbackClient(network);
  }

  /**
   * Robust balance fetching with retry logic and fallback
   */
  static async getBalance(
    client: SuiClient,
    address: string,
    network: SuiNetwork = 'testnet',
    timeoutMs: number = 10000
  ): Promise<{ totalBalance: string; coinObjectCount: number }> {
    return await this.retryOperation(async () => {
      try {
        // Try with timeout protection
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getBalance timeout')), timeoutMs)
        );
        
        const result = await Promise.race([
          client.getBalance({ owner: address }),
          timeoutPromise
        ]);
        
        return result as { totalBalance: string; coinObjectCount: number };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If it's a network error, try fallback client
        if (errorMessage.includes('failed to fetch') || 
            errorMessage.includes('timeout') || 
            errorMessage.includes('network')) {
          console.warn('Primary client failed for getBalance, trying fallback...');
          const fallbackClient = await this.getFallbackClient(network);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('getBalance fallback timeout')), timeoutMs)
          );
          
          const result = await Promise.race([
            fallbackClient.getBalance({ owner: address }),
            timeoutPromise
          ]);
          
          return result as { totalBalance: string; coinObjectCount: number };
        }
        
        throw error;
      }
    }, 3, 1000);
  }

  /**
   * Test network connectivity for debugging
   */
  static async healthCheck(
    client: SuiClient,
    network: SuiNetwork = 'testnet'
  ): Promise<{ healthy: boolean; latency: number; endpoint?: string }> {
    try {
      const startTime = Date.now();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      );
      
      await Promise.race([
        client.getLatestSuiSystemState(),
        timeoutPromise
      ]);
      
      const latency = Date.now() - startTime;
      return {
        healthy: true,
        latency,
        endpoint: 'primary'
      };
    } catch {
      console.warn('Primary endpoint health check failed, testing fallback...');
      
      try {
        const fallbackClient = await this.getFallbackClient(network);
        const startTime = Date.now();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fallback health check timeout')), 5000)
        );
        
        await Promise.race([
          fallbackClient.getLatestSuiSystemState(),
          timeoutPromise
        ]);
        
        const latency = Date.now() - startTime;
        return {
          healthy: true,
          latency,
          endpoint: 'fallback'
        };
      } catch {
        return {
          healthy: false,
          latency: -1
        };
      }
    }
  }

  /**
   * Clear fallback clients (useful for testing or when endpoints recover)
   */
  static clearFallbackClients(): void {
    this.fallbackClients.clear();
  }
}
