'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

interface Listing {
  id: string;
  screen_name: string;
  wallet_address: string | null;
  price_per_day: number;
  min_days: number;
  message: string | null;
  created_at: string;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
    
    // Refresh listings when page becomes visible (in case new listing was added)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchListings();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!supabase) {
        setError('Database not configured');
        setLoading(false);
        return;
      }

      console.log('Fetching listings from database...');

      const { data, error: supabaseError } = await supabase
        .from('listings')
        .select('id, screen_name, wallet_address, price_per_day, min_days, message, created_at')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.error('Error fetching listings:', supabaseError);
        setError('Failed to load listings: ' + supabaseError.message);
        setLoading(false);
        return;
      }

      console.log(`Successfully fetched ${data?.length || 0} listings from database`);
      
      if (data && data.length > 0) {
        console.log('Listings from database:', data.map(l => ({
          id: l.id,
          screen_name: l.screen_name,
          price_per_day: l.price_per_day,
          created_at: l.created_at
        })));
      }
      
      setListings(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to load listings: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Marketplace</h1>
          <p className={styles.subtitle}>
            Browse available header spaces for rent
          </p>
          <button 
            onClick={fetchListings} 
            className={styles.refreshButton}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}>Loading listings...</div>
          </div>
        ) : error ? (
          <div className={styles.errorCard}>
            <p>{error}</p>
            <button onClick={fetchListings} className={styles.retryButton}>
              Retry
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h2>No listings yet</h2>
            <p>Be the first to list your header space!</p>
            <a href="/listing" className={styles.createButton}>
              List My Banner
            </a>
          </div>
        ) : (
          <>
            <div className={styles.listingsCount}>
              Showing {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
            </div>
            <div className={styles.listingsGrid}>
            {listings.map((listing) => (
              <div key={listing.id} className={styles.listingCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.profileSection}>
                    <div className={styles.profileIcon}>@{listing.screen_name}</div>
                    <div className={styles.profileName}>{listing.screen_name}</div>
                  </div>
                  <div className={styles.priceSection}>
                    <div className={styles.priceAmount}>
                      {formatPrice(listing.price_per_day)} USDC
                    </div>
                    <div className={styles.priceLabel}>per day</div>
                  </div>
                </div>

                {listing.message && (
                  <div className={styles.messageSection}>
                    <p className={styles.message}>{listing.message}</p>
                  </div>
                )}

                <div className={styles.detailsSection}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Min. rental:</span>
                    <span className={styles.detailValue}>{listing.min_days} days</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Listed:</span>
                    <span className={styles.detailValue}>{formatDate(listing.created_at)}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <a 
                    href={`/rent/${listing.id}`}
                    className={styles.rentButton}
                  >
                    Rent This Space
                  </a>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </main>
  );
}

