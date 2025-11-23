'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useX402 } from '@coinbase/cdp-hooks';
import { useIsSignedIn, useEvmAddress } from '@coinbase/cdp-hooks';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

interface Listing {
  id: string;
  screen_name: string;
  price_per_day: number;
  min_days: number;
  message: string | null;
}

export default function RentPage() {
  const params = useParams();
  const listingId = params.listingId as string;
  const router = useRouter();
  const x402Hook = useX402();
  const { isSignedIn } = useIsSignedIn();
  const evmAddress = useEvmAddress();
  
  // Log x402 hook status for debugging
  useEffect(() => {
    if (x402Hook) {
      console.log('x402 hook initialized:', {
        hasFetchWithPayment: !!x402Hook.fetchWithPayment,
        type: typeof x402Hook.fetchWithPayment,
      });
    } else {
      console.warn('x402 hook not available');
    }
  }, [x402Hook]);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [adImage, setAdImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalPrice, setTotalPrice] = useState<number>(0);

  useEffect(() => {
    fetchListing();
  }, [listingId]);

  useEffect(() => {
    if (listing) {
      const price = listing.price_per_day * duration;
      setTotalPrice(price);
    }
  }, [duration, listing]);

  const fetchListing = async () => {
    try {
      if (!supabase) {
        setError('Database not configured');
        setLoading(false);
        return;
      }

      const { data, error: supabaseError } = await supabase
        .from('listings')
        .select('id, screen_name, price_per_day, min_days, message')
        .eq('id', listingId)
        .eq('active', true)
        .single();

      if (supabaseError || !data) {
        setError('Listing not found');
        setLoading(false);
        return;
      }

      setListing(data);
      setDuration(data.min_days); // Set default to minimum days
    } catch (err) {
      console.error('Error fetching listing:', err);
      setError('Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image file
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size must be less than 5MB');
        return;
      }
      setAdImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleRent = async () => {
    if (!isSignedIn || !evmAddress) {
      setError('Please connect your wallet first');
      return;
    }

    if (!adImage) {
      setError('Please upload an ad image');
      return;
    }

    if (!listing) {
      setError('Listing not found');
      return;
    }

    if (duration < listing.min_days) {
      setError(`Minimum rental period is ${listing.min_days} days`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Check if payment function is available
      if (!x402Hook || !x402Hook.fetchWithPayment || typeof x402Hook.fetchWithPayment !== 'function') {
        console.error('x402 hook not available:', x402Hook);
        throw new Error('Payment system not initialized. Please refresh the page and try again.');
      }
      
      const fetchWithPayment = x402Hook.fetchWithPayment;

      // Convert image to base64 for upload
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(adImage);
      });

      // Prepare rental data
      const rentalData = {
        listingId,
        duration,
        totalPrice,
        adImage: imageBase64,
        walletAddress: typeof evmAddress === 'string' ? evmAddress : String(evmAddress || ''),
      };

      // Make payment request using x402
      // The useX402 hook will automatically handle 402 Payment Required responses
      // and process the payment before retrying the request

      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/rentals/create`
        : '/api/rentals/create';
      
      console.log('Making payment request with x402...', { apiUrl });
      
      let response;
      try {
        console.log('Calling fetchWithPayment with:', { 
          apiUrl, 
          rentalData: { ...rentalData, adImage: '[base64]' },
          totalPrice,
          walletAddress: typeof evmAddress === 'string' ? evmAddress : String(evmAddress || ''),
        });
        
        response = await fetchWithPayment(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rentalData),
        });
        
        console.log('Payment response received:', { 
          status: response.status, 
          ok: response.ok,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
        
        // Log response body for debugging
        const responseClone = response.clone();
        try {
          const responseText = await responseClone.text();
          console.log('Payment response body:', responseText);
          if (responseText) {
            try {
              const responseJson = JSON.parse(responseText);
              console.log('Payment response JSON:', responseJson);
            } catch (e) {
              console.log('Response is not JSON');
            }
          }
        } catch (e) {
          console.error('Error reading response body:', e);
        }
      } catch (x402Error: any) {
        console.error('x402 payment error details:', {
          error: x402Error,
          message: x402Error?.message,
          stack: x402Error?.stack,
          name: x402Error?.name,
          toString: x402Error?.toString(),
          cause: x402Error?.cause,
        });
        
        // Show the actual error message to help debug
        const errorMessage = x402Error?.message || x402Error?.toString() || 'Unknown payment error';
        
        // The "map" error suggests the x402 library couldn't parse the payment requirements
        // This usually means the 402 response format is incorrect
        if (errorMessage.includes('map') || errorMessage.includes('Cannot read')) {
          console.error('x402 response parsing error - this suggests the 402 response format may be incorrect');
          throw new Error(
            `Payment system configuration error. The server's payment response format is invalid. ` +
            `Please contact support or try again later. ` +
            `Technical details: ${errorMessage}`
          );
        }
        
        if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        
        if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
          throw new Error('Payment was cancelled. Please try again when ready.');
        }
        
        if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
          throw new Error('Insufficient USDC balance. Please ensure you have enough USDC on Base Sepolia.');
        }
        
        // Show the actual error for debugging
        throw new Error(`Payment failed: ${errorMessage}`);
      }

      if (!response.ok) {
        let errorMessage = `Payment failed with status ${response.status}`;
        let errorDetails: any = null;
        
        try {
          const responseText = await response.clone().text();
          console.error('Payment failed - response body:', responseText);
          
          if (responseText) {
            try {
              const errorData = JSON.parse(responseText);
              errorDetails = errorData;
              errorMessage = errorData.error || errorData.message || errorData.errorMessage || errorMessage;
              
              // Log detailed error information
              console.error('Payment error details:', {
                status: response.status,
                error: errorData.error,
                message: errorData.message,
                errorMessage: errorData.errorMessage,
                fullError: errorData,
              });
            } catch (e) {
              errorMessage = responseText || errorMessage;
            }
          }
        } catch (e) {
          console.error('Error reading error response:', e);
        }
        
        // Provide more specific error messages
        if (response.status === 402) {
          throw new Error('Payment required but payment processing failed. Please try again.');
        } else if (response.status === 400) {
          throw new Error(`Invalid request: ${errorMessage}`);
        } else if (response.status === 500) {
          throw new Error(`Server error: ${errorMessage}. Please try again later.`);
        }
        
        throw new Error(errorMessage);
      }

      let result;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }
      
      // After successful payment, create the rental record
      if (result && result.rentalId) {
        // Redirect to success page
        router.push(`/rent/${listingId}/success?rentalId=${result.rentalId}`);
      } else {
        console.error('Unexpected response format:', result);
        throw new Error('Rental ID not received in response');
      }
    } catch (err) {
      console.error('Error processing rental:', err);
      setError(err instanceof Error ? err.message : 'Failed to process rental');
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.loading}>Loading listing...</div>
        </div>
      </main>
    );
  }

  if (error && !listing) {
    return (
      <main>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.errorCard}>
            <p>{error}</p>
            <button onClick={() => router.push('/marketplace')} className={styles.backButton}>
              Back to Marketplace
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!listing) return null;

  return (
    <main>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>Rent Header Space</h1>
          <p className={styles.subtitle}>
            Rent banner space from @{listing.screen_name}
          </p>

                 {!isSignedIn && (
                   <div className={styles.warningCard}>
                     <p>⚠️ Please connect your wallet to proceed with payment.</p>
                   </div>
                 )}

          <div className={styles.rentalForm}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Upload Ad Image</h2>
              <div className={styles.imageUpload}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className={styles.fileInput}
                  id="adImage"
                />
                <label htmlFor="adImage" className={styles.uploadLabel}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className={styles.previewImage} />
                  ) : (
                    <div className={styles.uploadPlaceholder}>
                      <span>📷</span>
                      <span>Click to upload ad image</span>
                      <small>Max 5MB, PNG/JPG</small>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Rental Duration</h2>
              <div className={styles.durationInput}>
                <input
                  type="number"
                  min={listing.min_days}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || listing.min_days)}
                  className={styles.input}
                />
                <span className={styles.durationLabel}>days</span>
              </div>
              <p className={styles.helpText}>
                Minimum rental period: {listing.min_days} days
              </p>
            </div>

            <div className={styles.priceSection}>
              <div className={styles.priceRow}>
                <span>Price per day:</span>
                <span className={styles.priceValue}>{listing.price_per_day.toFixed(2)} USDC</span>
              </div>
              <div className={styles.priceRow}>
                <span>Duration:</span>
                <span className={styles.priceValue}>{duration} days</span>
              </div>
              <div className={styles.priceRowTotal}>
                <span>Total Amount:</span>
                <span className={styles.totalPrice}>{totalPrice.toFixed(2)} USDC</span>
              </div>
            </div>

                   <button
                     onClick={handleRent}
                     disabled={isProcessing || !adImage || !isSignedIn}
                     className={styles.rentButton}
                   >
                     {isProcessing ? 'Processing Payment...' : `Pay ${totalPrice.toFixed(2)} USDC & Rent`}
                   </button>
          </div>
        </div>
      </div>
    </main>
  );
}

