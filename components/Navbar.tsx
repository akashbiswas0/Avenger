'use client';

import React, { useState, useEffect } from 'react';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsMobileMenuOpen(false);
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
            href="#buy" 
            className={styles.navLink}
            onClick={(e) => handleLinkClick(e, '#buy')}
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
          <button className={styles.ctaButton}>
            Get Started
          </button>
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

