'use client';

import { AuthButton } from '@coinbase/cdp-react/components/AuthButton';
import { useIsSignedIn, useIsInitialized, useEvmAddress } from '@coinbase/cdp-hooks';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../app/verification/page.module.css';

export function WalletConnection() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const evmAddress = useEvmAddress();
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();

  // Show loading state while SDK initializes
  if (!isInitialized) {
    return (
      <div className={styles.walletButtonWrapper}>
        <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
          Initializing wallet...
        </div>
      </div>
    );
  }

  // Redirect to /listing after successful wallet connection
  useEffect(() => {
    if (isSignedIn && evmAddress) {
      // Wait a moment to ensure wallet is fully connected, then redirect
      const timer = setTimeout(() => {
        router.push('/listing');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn, evmAddress, router]);

  // User is signed in - show wallet info
  if (isSignedIn) {
    // Ensure evmAddress is a string
    const addressString = typeof evmAddress === 'string' ? evmAddress : String(evmAddress || '');
    
    const copyAddress = async () => {
      if (!addressString) return;
      try {
        await navigator.clipboard.writeText(addressString);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    };

    if (!addressString) {
      return (
        <div className={styles.walletConnected}>
          <div className={styles.walletIcon}>✓</div>
          <span>Wallet Connected (Loading address...)</span>
        </div>
      );
    }

    return (
      <div className={styles.walletConnected}>
        <div className={styles.walletIcon}>✓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', marginBottom: '4px' }}>Wallet Connected</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Redirecting to listing page...
          </div>
          <button
            onClick={copyAddress}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '4px'
            }}
          >
            {isCopied ? '✓ Copied!' : '📋'}
            <span style={{ fontFamily: 'monospace' }}>
              {addressString.length > 10 
                ? `${addressString.slice(0, 6)}...${addressString.slice(-4)}`
                : addressString}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // User not signed in - show sign in button
  return (
    <div>
      <AuthButton 
        onSignInSuccess={() => {
          console.log('Wallet connected successfully');
          // Redirect will happen automatically via useEffect when isSignedIn becomes true
        }}
      />
      <div style={{ marginTop: '12px', fontSize: '11px', color: '#666', textAlign: 'center', padding: '8px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>📝 Setup Required</p>
        <p style={{ margin: '0', fontSize: '10px' }}>
          Add <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '2px' }}>http://localhost:3000</code> to{' '}
          <a 
            href="https://portal.cdp.coinbase.com/products/embedded-wallets/domains" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            Domains Configuration
          </a>
          {' '}in Coinbase Portal
        </p>
      </div>
    </div>
  );
}

