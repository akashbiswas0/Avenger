'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

export default function ListingPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    
    if (connected === 'true') {
      // Refresh to show connected state
      checkConnectedAccount();
      // Clean URL
      window.history.replaceState({}, '', '/listing');
    } else if (error) {
      setError(getErrorMessage(error));
    } else {
      // Check if user already has a connected account
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
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const checkConnectedAccount = async () => {
    try {
      const response = await fetch('/api/x-account/check');
      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.screenName) {
          setConnectedAccount(data.screenName);
        }
      }
    } catch (err) {
      console.error('Error checking connected account:', err);
    }
  };

  const handleConnectX = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Initiate OAuth flow
      const response = await fetch('/api/x-oauth/initiate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();
      
      // Store oauth_token_secret temporarily in sessionStorage
      // In production, this should be stored server-side
      if (data.oauthTokenSecret) {
        sessionStorage.setItem('oauth_token_secret', data.oauthTokenSecret);
        sessionStorage.setItem('oauth_token', data.oauthToken);
      }
      
      // Redirect to X OAuth authorization page
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect X account');
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
              <button 
                className={styles.disconnectButton}
                onClick={async () => {
                  try {
                    await fetch('/api/x-account/disconnect', { method: 'POST' });
                    setConnectedAccount(null);
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

