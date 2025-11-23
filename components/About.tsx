import React from 'react';
import styles from './About.module.css';

const About = () => {
  return (
    <section id="how-it-works" className={styles.about}>
      <div className={styles.container}>
        <h2 className={styles.title}>How it works</h2>
        <p className={styles.subtitle}>Simple steps for both sellers and advertisers</p>
        
        <div className={styles.columns}>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>For Sellers</h3>
            
            <div className={styles.stepCard}>
              <div className={styles.stepIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Connect</h4>
              <p className={styles.stepDescription}>Link your Twitter account and verify your profile</p>
            </div>
            
            <div className={styles.stepCard}>
              <div className={styles.stepIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Set Price</h4>
              <p className={styles.stepDescription}>Choose your rates for weekly or monthly ad placements</p>
            </div>
            
            <div className={styles.stepCard}>
              <div className={styles.stepIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Earn</h4>
              <p className={styles.stepDescription}>Get paid when advertisers book your header space</p>
            </div>
          </div>
          
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>For Advertisers</h3>
            
            <div className={styles.stepCard}>
              <div className={`${styles.stepIcon} ${styles.stepIconAlt}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Browse</h4>
              <p className={styles.stepDescription}>Find Twitter profiles that match your target audience</p>
            </div>
            
            <div className={styles.stepCard}>
              <div className={`${styles.stepIcon} ${styles.stepIconAlt}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Upload Ad</h4>
              <p className={styles.stepDescription}>Submit your banner and preview how it looks</p>
            </div>
            
            <div className={styles.stepCard}>
              <div className={`${styles.stepIcon} ${styles.stepIconAlt}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <h4 className={styles.stepTitle}>Pay</h4>
              <p className={styles.stepDescription}>Secure payment with instant campaign activation</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;

