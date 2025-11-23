'use client';

import React, { useState, useEffect } from 'react';
import { AuthButton } from '@coinbase/cdp-react/components/AuthButton';
import { useIsSignedIn, useIsInitialized, useEvmAddress, useSignOut } from '@coinbase/cdp-hooks';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const evmAddress = useEvmAddress();
  const { signOut } = useSignOut();

  // Debug: Log evmAddress structure
  useEffect(() => {
    if (evmAddress) {
      console.log('evmAddress structure:', {
        type: typeof evmAddress,
        value: evmAddress,
        stringified: JSON.stringify(evmAddress),
        keys: typeof evmAddress === 'object' ? Object.keys(evmAddress as any) : null,
      });
    }
  }, [evmAddress]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Check if user has a connected account
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

    checkConnectedAccount();

    // Listen for account connection events
    const handleAccountConnected = () => {
      checkConnectedAccount();
    };
    window.addEventListener('accountConnected', handleAccountConnected);
    
    // Also check periodically (in case of same-tab updates)
    const interval = setInterval(checkConnectedAccount, 2000);
    
    return () => {
      window.removeEventListener('accountConnected', handleAccountConnected);
      clearInterval(interval);
    };
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsMobileMenuOpen(false);
  };

  const getAddressString = (): string => {
    if (typeof evmAddress === 'string') {
      return evmAddress;
    } else if (evmAddress && typeof evmAddress === 'object') {
      const address = (evmAddress as any).address || 
                     (evmAddress as any).evmAddress || 
                     (evmAddress as any).value ||
                     '';
      
      if (address) return address;
      
      // Try to extract from JSON
      const str = JSON.stringify(evmAddress);
      const addressMatch = str.match(/0x[a-fA-F0-9]{40}/);
      if (addressMatch) {
        return addressMatch[0];
      }
    }
    return '';
  };

  const copyWalletAddress = async () => {
    const addressString = getAddressString();
    
    if (!addressString || addressString === '[object Object]' || !addressString.startsWith('0x')) {
      return;
    }
    
    try {
      await navigator.clipboard.writeText(addressString);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await signOut();
      setShowDisconnectMenu(false);
      console.log('Wallet disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    }
  };

  return (
    <nav className={`${styles.navbar} ${isScrolled ? styles.scrolled : ''}`}>
      <div className={styles.container}>
        <a href="#home" className={styles.logo} onClick={(e) => handleLinkClick(e, '#home')}>
          <div className={styles.logoIcon}>RM</div>
          <span className={styles.logoText}>RentMyHeader</span>
        </a>
        
        <div className={`${styles.navLinks} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
          <a 
            href="#sell" 
            className={styles.navLink}
            onClick={(e) => handleLinkClick(e, '#sell')}
          >
            Sell Space
          </a>
          <a 
            href="/marketplace" 
            className={styles.navLink}
          >
            Buy Ads
          </a>
          <a 
            href="#how-it-works" 
            className={styles.navLink}
            onClick={(e) => handleLinkClick(e, '#how-it-works')}
          >
            How It Works
          </a>
          {connectedAccount && (
            <div className={styles.profileBadge}>
              <span className={styles.profileIcon}>@</span>
              <span className={styles.profileName}>{connectedAccount}</span>
            </div>
          )}
          {isSignedIn && evmAddress && (() => {
            const addressString = getAddressString();
            
            // Don't render if address is invalid or still object-like
            if (!addressString || 
                addressString === '[object Object]' || 
                addressString.length < 10 ||
                !addressString.startsWith('0x')) {
              return null;
            }
            
            return (
              <div 
                className={styles.walletBadgeContainer}
                onMouseEnter={() => setShowDisconnectMenu(true)}
                onMouseLeave={() => setShowDisconnectMenu(false)}
              >
                <div className={styles.walletBadge} onClick={copyWalletAddress} title="Click to copy">
                  <span className={styles.walletIcon}>💼</span>
                  <span className={styles.walletAddress}>
                    {addressString.length > 10
                      ? `${addressString.slice(0, 6)}...${addressString.slice(-4)}`
                      : addressString}
                  </span>
                  {isCopied && <span className={styles.copiedText}>✓</span>}
                </div>
                {showDisconnectMenu && (
                  <button 
                    className={styles.disconnectButton}
                    onClick={handleDisconnectWallet}
                    title="Disconnect wallet"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            );
          })()}
          {!connectedAccount && !isSignedIn && (
            <button className={styles.ctaButton}>
              Get Started
            </button>
          )}
          {isInitialized && !isSignedIn && (
            <div className={styles.walletButtonContainer}>
              <AuthButton />
            </div>
          )}
        </div>

        <button 
          className={styles.mobileMenuButton}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.hamburger} ${isMobileMenuOpen ? styles.open : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

