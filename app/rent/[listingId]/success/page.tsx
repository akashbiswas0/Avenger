'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function RentalSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rentalId = searchParams.get('rentalId');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!rentalId) {
      router.push('/marketplace');
      return;
    }

    // Countdown before redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/marketplace');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rentalId, router]);

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>Payment Successful!</h1>
          <p className={styles.message}>
            Your rental request has been submitted and payment has been processed.
          </p>
          <div className={styles.details}>
            <p><strong>Rental ID:</strong> {rentalId}</p>
            <p>Your request is pending approval from the banner owner. Once approved, your ad will be displayed on the header space for the selected duration.</p>
          </div>
          <div className={styles.actions}>
            <button 
              onClick={() => router.push('/marketplace')}
              className={styles.button}
            >
              Back to Marketplace
            </button>
            <p className={styles.redirect}>
              Redirecting in {countdown} seconds...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

