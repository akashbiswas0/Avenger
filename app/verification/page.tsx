'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { WalletConnection } from '@/components/WalletConnection';
import styles from './page.module.css';

export default function VerificationPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    const accountParam = params.get('account');
    
    console.log('Page load - URL params:', { connected, error, accountParam });
    
    if (connected === 'true') {
      console.log('OAuth callback detected, account param:', accountParam);
      
      // Store account in sessionStorage immediately if provided
      if (accountParam && typeof window !== 'undefined') {
        sessionStorage.setItem('x_account_screen_name', accountParam);
        console.log('Stored account in sessionStorage:', accountParam);
        // Set the state immediately if we have the account name
        setConnectedAccount(accountParam);
        // Trigger navbar update immediately
        window.dispatchEvent(new Event('accountConnected'));
      }
      
      // Clean URL
      window.history.replaceState({}, '', '/verification');
      
      // Wait a bit for database to be updated, then verify account exists in DB
      setTimeout(() => {
        checkConnectedAccount().then(() => {
          console.log('Account check completed');
        });
      }, 1500); // Increased delay to ensure DB write is complete
    } else if (error) {
      setError(getErrorMessage(error));
    } else {
      // Check if user already has a connected account
      // First check sessionStorage for quick display
      const storedAccount = typeof window !== 'undefined' ? sessionStorage.getItem('x_account_screen_name') : null;
      if (storedAccount) {
        console.log('Found stored account in sessionStorage:', storedAccount);
        setConnectedAccount(storedAccount);
      }
      
      // Then verify with database
      checkConnectedAccount();
    }
  }, []);
  
  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'access_denied':
        return 'X account connection was cancelled.';
      case 'session_expired':
        return 'Session expired. Please try again.';
      case 'not_authenticated':
        return 'Please log in to connect your X account.';
      case 'database_error':
        return 'Failed to save account. Please try again.';
      case 'oauth_failed':
        return 'Failed to connect X account. Please try again.';
      case 'invalid_state':
        return 'Security verification failed. Please try connecting again.';
      case 'missing_state_cookie':
        return 'Session expired during connection. Please try again.';
      case 'missing_code_verifier':
        return 'Session expired. Please try again.';
      case 'token_exchange_failed':
        return 'Failed to complete connection. Please check your X app settings.';
      case 'no_access_token':
        return 'No access token received. Please try again.';
      case 'user_info_failed':
        return 'Failed to retrieve account information. Please try again.';
      case 'invalid_user_data':
        return 'Invalid account data received. Please try again.';
      default:
        return `Connection error: ${error}. Please try again.`;
    }
  };

  const checkConnectedAccount = async (retryCount = 0): Promise<void> => {
    try {
      // Try to get stored account identifier from URL params first, then sessionStorage
      const params = new URLSearchParams(window.location.search);
      const storedScreenName = params.get('account') || 
        (typeof window !== 'undefined' ? sessionStorage.getItem('x_account_screen_name') : null);
      
      let url = '/api/x-account/check';
      if (storedScreenName) {
        url += `?screen_name=${encodeURIComponent(storedScreenName)}`;
      }
      
      console.log('Checking account with URL:', url, 'retry:', retryCount);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Account check response:', data);
        
        if (data.connected && data.screenName) {
          console.log('Setting connected account:', data.screenName);
          setConnectedAccount(data.screenName);
          
          // Store in sessionStorage for this tab session only (not localStorage)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('x_account_screen_name', data.screenName);
            if (data.xUserId) {
              sessionStorage.setItem('x_account_id', data.xUserId);
            }
          }
        } else {
          // Retry up to 3 times if account not found (might be still saving to DB)
          if (retryCount < 3 && storedScreenName) {
            console.log(`Account not found, retrying... (${retryCount + 1}/3)`);
            setTimeout(() => {
              checkConnectedAccount(retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff
          } else {
            console.log('No connected account found in response:', data);
            setConnectedAccount(null);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('Account check failed:', response.status, errorText);
        // Retry on error too
        if (retryCount < 2) {
          setTimeout(() => {
            checkConnectedAccount(retryCount + 1);
          }, 1000 * (retryCount + 1));
        } else {
          setConnectedAccount(null);
        }
      }
    } catch (err) {
      console.error('Error checking connected account:', err);
      // Retry on network errors
      if (retryCount < 2) {
        setTimeout(() => {
          checkConnectedAccount(retryCount + 1);
        }, 1000 * (retryCount + 1));
      } else {
        setConnectedAccount(null);
      }
    }
  };


  const handleConnectX = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Redirect to OAuth 2.0 authorization endpoint
      // Use window.location.replace to prevent back button issues
      window.location.replace('/api/x-oauth2/authorize');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect X account';
      setError(errorMessage);
      setIsConnecting(false);
    }
  };

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>List Your Header</h1>
          <p className={styles.subtitle}>
            Connect your X account to start earning from your header space
          </p>

          {connectedAccount ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>✓</div>
              <h2 className={styles.successTitle}>Successfully connected</h2>
              <p className={styles.successHandle}>@{connectedAccount}</p>
              
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}
              
              <div className={styles.walletSection}>
                <h3 className={styles.walletTitle}>Connect Wallet</h3>
                <p className={styles.walletDescription}>
                  Connect your wallet to receive payments for your header space
                </p>
                <div className={styles.walletButtonWrapper}>
                  <WalletConnection />
                </div>
              </div>
              
              <button 
                className={styles.disconnectButton}
                onClick={async () => {
                  try {
                    // Get account identifier
                    const screenName = typeof window !== 'undefined' ? sessionStorage.getItem('x_account_screen_name') : null;
                    const xUserId = typeof window !== 'undefined' ? sessionStorage.getItem('x_account_id') : null;
                    
                    const body: any = {};
                    if (xUserId) {
                      body.x_user_id = xUserId;
                    } else if (screenName) {
                      body.screen_name = screenName;
                    }
                    
                    await fetch('/api/x-account/disconnect', { 
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    setConnectedAccount(null);
                    // Clear sessionStorage
                    if (typeof window !== 'undefined') {
                      sessionStorage.removeItem('x_account_screen_name');
                      sessionStorage.removeItem('x_account_id');
                    }
                  } catch (err) {
                    console.error('Error disconnecting:', err);
                  }
                }}
              >
                Disconnect Account
              </button>
            </div>
          ) : (
            <div className={styles.connectCard}>
              <div className={styles.iconWrapper}>
                <svg 
                  className={styles.xIcon} 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <h2 className={styles.connectTitle}>Connect Your X Account</h2>
              <p className={styles.connectDescription}>
                Link your X (Twitter) account to start selling your header space to advertisers.
                You'll be able to set your own prices and control which ads appear.
              </p>
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}
              <button
                className={styles.connectButton}
                onClick={handleConnectX}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect X'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

