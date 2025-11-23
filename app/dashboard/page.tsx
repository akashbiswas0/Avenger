'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface Rental {
  id: string;
  listing_id: string;
  advertiser_wallet_address: string;
  ad_image_url: string;
  duration_days: number;
  total_price: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  status: string;
  payment_status: string;
  created_at: string;
  days_paid: number;
  verification_failed: boolean;
  listings: {
    screen_name: string;
    price_per_day: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn } = useIsSignedIn();
  const evmAddress = useEvmAddress();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !evmAddress) {
      router.push('/verification');
      return;
    }

    fetchRentals();
  }, [isSignedIn, evmAddress, router]);

  const fetchRentals = async () => {
    try {
      if (!supabase) {
        setError('Database not configured');
        setLoading(false);
        return;
      }

      const addressString = typeof evmAddress === 'string' ? evmAddress : String(evmAddress || '');

      // Get listings owned by this wallet
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id')
        .eq('wallet_address', addressString)
        .eq('active', true);

      if (listingsError) {
        throw listingsError;
      }

      if (!listings || listings.length === 0) {
        setRentals([]);
        setLoading(false);
        return;
      }

      const listingIds = listings.map(l => l.id);

      // Get rentals for these listings
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select(`
          *,
          listings!inner (
            screen_name,
            price_per_day
          )
        `)
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false });

      if (rentalsError) {
        throw rentalsError;
      }

      setRentals(rentalsData || []);
    } catch (err) {
      console.error('Error fetching rentals:', err);
      setError('Failed to load rental requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (rentalId: string, action: 'approved' | 'rejected') => {
    setProcessingId(rentalId);
    setError(null);

    try {
      const response = await fetch('/api/rentals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rentalId,
          action,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update approval status');
      }

      // Refresh rentals
      await fetchRentals();
    } catch (err) {
      console.error('Error updating approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to update approval status');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </main>
    );
  }

  const pendingRentals = rentals.filter(r => r.approval_status === 'pending');
  const activeRentals = rentals.filter(r => r.approval_status === 'approved' && r.status === 'active');
  const completedRentals = rentals.filter(r => r.status !== 'active' || r.verification_failed);

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>Banner Owner Dashboard</h1>

        {error && <div className={styles.error}>{error}</div>}

        {/* Pending Approvals */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Pending Approvals ({pendingRentals.length})
          </h2>
          {pendingRentals.length === 0 ? (
            <p className={styles.empty}>No pending rental requests</p>
          ) : (
            <div className={styles.rentalGrid}>
              {pendingRentals.map((rental) => (
                <div key={rental.id} className={styles.rentalCard}>
                  <div className={styles.cardHeader}>
                    <h3>@{rental.listings.screen_name}</h3>
                    <span className={styles.statusBadge}>{rental.approval_status}</span>
                  </div>
                  <div className={styles.adImage}>
                    <img 
                      src={rental.ad_image_url} 
                      alt="Ad preview" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                  </div>
                  <div className={styles.cardDetails}>
                    <p><strong>Duration:</strong> {rental.duration_days} days</p>
                    <p><strong>Total Price:</strong> {rental.total_price} USDC</p>
                    <p><strong>Daily Rate:</strong> {rental.listings.price_per_day} USDC/day</p>
                    <p><strong>Advertiser:</strong> {rental.advertiser_wallet_address.substring(0, 10)}...{rental.advertiser_wallet_address.substring(rental.advertiser_wallet_address.length - 4)}</p>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => handleApproval(rental.id, 'approved')}
                      disabled={processingId === rental.id}
                      className={styles.approveButton}
                    >
                      {processingId === rental.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleApproval(rental.id, 'rejected')}
                      disabled={processingId === rental.id}
                      className={styles.rejectButton}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Rentals */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Active Rentals ({activeRentals.length})
          </h2>
          {activeRentals.length === 0 ? (
            <p className={styles.empty}>No active rentals</p>
          ) : (
            <div className={styles.rentalGrid}>
              {activeRentals.map((rental) => (
                <div key={rental.id} className={styles.rentalCard}>
                  <div className={styles.cardHeader}>
                    <h3>@{rental.listings.screen_name}</h3>
                    <span className={`${styles.statusBadge} ${styles.active}`}>Active</span>
                  </div>
                  <div className={styles.adImage}>
                    <img 
                      src={rental.ad_image_url} 
                      alt="Ad preview"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                  </div>
                  <div className={styles.cardDetails}>
                    <p><strong>Days Paid:</strong> {rental.days_paid} / {rental.duration_days}</p>
                    <p><strong>Daily Rate:</strong> {rental.listings.price_per_day} USDC/day</p>
                    <p><strong>Total Earned:</strong> {(rental.days_paid * rental.listings.price_per_day).toFixed(2)} USDC</p>
                    {rental.verification_failed && (
                      <p className={styles.warning}>⚠️ Ad verification failed - payments stopped</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed/Failed Rentals */}
        {completedRentals.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Completed Rentals ({completedRentals.length})
            </h2>
            <div className={styles.rentalGrid}>
              {completedRentals.map((rental) => (
                <div key={rental.id} className={styles.rentalCard}>
                  <div className={styles.cardHeader}>
                    <h3>@{rental.listings.screen_name}</h3>
                    <span className={styles.statusBadge}>
                      {rental.verification_failed ? 'Failed' : 'Completed'}
                    </span>
                  </div>
                  <div className={styles.cardDetails}>
                    <p><strong>Final Days Paid:</strong> {rental.days_paid} / {rental.duration_days}</p>
                    <p><strong>Total Earned:</strong> {(rental.days_paid * rental.listings.price_per_day).toFixed(2)} USDC</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

