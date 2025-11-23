'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function ListingPage() {
  const [price, setPrice] = useState('0.01');
  const [minDays, setMinDays] = useState('7');
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xAccount, setXAccount] = useState<{ screenName: string; xUserId: string } | null>(null);
  
  const { isSignedIn } = useIsSignedIn();
  const evmAddress = useEvmAddress();
  const router = useRouter();

  useEffect(() => {
    // Get X account info from sessionStorage or API
    const getXAccount = async () => {
      const screenName = typeof window !== 'undefined' ? sessionStorage.getItem('x_account_screen_name') : null;
      const xUserId = typeof window !== 'undefined' ? sessionStorage.getItem('x_account_id') : null;
      
      if (screenName && xUserId) {
        setXAccount({ screenName, xUserId });
      } else {
        // Try to fetch from API
        try {
          const response = await fetch('/api/x-account/check');
          if (response.ok) {
            const data = await response.json();
            if (data.connected && data.screenName && data.xUserId) {
              setXAccount({ screenName: data.screenName, xUserId: data.xUserId });
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('x_account_screen_name', data.screenName);
                sessionStorage.setItem('x_account_id', data.xUserId);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching X account:', err);
        }
      }
    };

    getXAccount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError('Please agree to keep the ad banner unchanged during the rental period');
      return;
    }

    if (!xAccount) {
      setError('X account not connected. Please connect your X account first.');
      return;
    }

    if (!isSignedIn || !evmAddress) {
      setError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!supabase) {
        setError('Database not configured. Please check your environment variables.');
        setIsSubmitting(false);
        return;
      }

      const addressString = typeof evmAddress === 'string' ? evmAddress : String(evmAddress || '');
      
      const { data, error: supabaseError } = await supabase
        .from('listings')
        .insert({
          x_user_id: xAccount.xUserId,
          screen_name: xAccount.screenName,
          wallet_address: addressString,
          price_per_day: parseFloat(price),
          min_days: parseInt(minDays),
          message: message || null,
          active: true,
        })
        .select()
        .single();

      if (supabaseError) {
        console.error('Supabase error:', supabaseError);
        setError(supabaseError.message || 'Failed to create listing');
        setIsSubmitting(false);
        return;
      }

      // Success - redirect to home page
      router.push('/');
    } catch (err) {
      console.error('Error creating listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to create listing');
      setIsSubmitting(false);
    }
  };

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>List My Banner</h1>
          <p className={styles.subtitle}>
            Set your price and start earning from your header space
          </p>

          {!xAccount && (
            <div className={styles.warningCard}>
              <p>⚠️ Please connect your X account first on the <a href="/verification">verification page</a>.</p>
            </div>
          )}

          {!isSignedIn && (
            <div className={styles.warningCard}>
              <p>⚠️ Please connect your wallet first.</p>
            </div>
          )}

          {xAccount && isSignedIn && (
            <form onSubmit={handleSubmit} className={styles.formCard}>
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Price per day (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.01"
                  className={styles.input}
                  required
                />
                <p className={styles.helpText}>
                  How much you earn every day the ad stays live
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Minimum rental days
                </label>
                <input
                  type="number"
                  min="1"
                  value={minDays}
                  onChange={(e) => setMinDays(e.target.value)}
                  placeholder="7"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Short message to advertisers (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="My audience loves Web3 tools and memes!"
                  rows={3}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>I agree to keep the ad banner unchanged during the rental period</span>
                </label>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || !agreed}
              >
                {isSubmitting ? 'Creating Listing...' : 'List My Banner for Rent'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
