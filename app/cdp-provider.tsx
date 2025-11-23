'use client';

import { CDPReactProvider, type Config } from '@coinbase/cdp-react';
import { useEffect } from 'react';

export function CDPProvider({ children }: { children: React.ReactNode }) {
  // Get project ID directly from environment variable (available at build time)
  const envProjectId = process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID || '';
  const isConfigured = !!envProjectId && 
    envProjectId !== 'your-project-id' && 
    envProjectId !== 'your-actual-project-id-here';
  
  useEffect(() => {
    if (!isConfigured) {
      console.warn('⚠️ Coinbase CDP Project ID not configured.');
      console.warn('⚠️ Please set NEXT_PUBLIC_COINBASE_PROJECT_ID in .env.local and restart the server.');
      console.warn('⚠️ Get your project ID from: https://portal.cdp.coinbase.com');
    } else {
      console.log('✅ Coinbase CDP initialized with project ID:', envProjectId.substring(0, 8) + '...');
    }
  }, [envProjectId, isConfigured]);
  
  // Always render the provider to ensure hooks have context
  // Use the actual project ID or a placeholder (SDK will handle errors gracefully)
  const config: Config = {
    projectId: isConfigured ? envProjectId : 'placeholder-project-id',
    ethereum: {
      createOnLogin: 'eoa' // Creates EVM EOA (Regular Accounts) on login
      // Use 'smart' for Smart Accounts instead
    },
    solana: {
      createOnLogin: true // Creates Solana account on login (optional)
    },
    appName: 'RentMyHeader',
    authMethods: ['email', 'sms'] // Available auth methods
  };
  
  return (
    <CDPReactProvider config={config}>
      {children}
    </CDPReactProvider>
  );
}

