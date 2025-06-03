export const APP_CONFIG = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    timeout: 5000,
  },
  
  // Task Configuration
  task: {
    urgencyLevels: ['low', 'standard', 'high', 'urgent'] as const,
    categories: [
      'language',
      'admin', 
      'content',
      'development',
      'design',
      'marketing',
      'research',
      'other'
    ],
    defaultUrgency: 'standard' as const,
  },
  
  // UI Configuration
  ui: {
    tasksPerPage: 10,
    autoRefreshInterval: 30000, // 30 seconds
    notifications: {
      duration: 5000, // 5 seconds
    }
  },
  
  // SUI Blockchain Configuration
  sui: {
    network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
    defaultGasPrice: 1000,
  }
} as const;

export type UrgencyLevel = typeof APP_CONFIG.task.urgencyLevels[number];
export type TaskCategory = typeof APP_CONFIG.task.categories[number];
