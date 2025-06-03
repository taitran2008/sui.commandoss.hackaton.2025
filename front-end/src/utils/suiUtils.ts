// Utility functions for SUI blockchain operations

/**
 * Convert MIST (smallest SUI unit) to SUI
 * 1 SUI = 1,000,000,000 MIST
 */
export function formatSuiBalance(mistBalance: string | bigint): string {
  const balance = BigInt(mistBalance);
  const suiWhole = balance / BigInt(1_000_000_000);
  const mistRemainder = balance % BigInt(1_000_000_000);
  
  if (mistRemainder === BigInt(0)) {
    return suiWhole.toString();
  }
  
  const decimal = Number(mistRemainder) / 1_000_000_000;
  const formattedBalance = (Number(suiWhole) + decimal).toFixed(9);
  
  // Remove trailing zeros
  return formattedBalance.replace(/\.?0+$/, '');
}

/**
 * Convert SUI to MIST for transactions
 */
export function suiToMist(suiAmount: string | number): bigint {
  const amount = typeof suiAmount === 'string' ? parseFloat(suiAmount) : suiAmount;
  return BigInt(Math.floor(amount * 1_000_000_000));
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Validate SUI address format
 */
export function isValidSuiAddress(address: string): boolean {
  // SUI addresses start with 0x and are 64 characters long (including 0x)
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}
