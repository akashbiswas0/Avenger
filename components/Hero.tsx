import React from 'react';
import styles from './Hero.module.css';

const Hero = () => {
  return (
    <section id="home" className={styles.hero}>
      <div className={styles.container}>
        <h1 className={styles.headline}>
          Turn your <span className={styles.italic}>Twitter</span> header into passive income
        </h1>
        <p className={styles.subheadline}>
          Advertisers pay you to display banners on your profile. You control what shows, you set the price.
        </p>
        <div className={styles.ctaButtons}>
          <button className={`${styles.button} ${styles.buttonPrimary}`}>
            Sell My Header
          </button>
          <button className={`${styles.button} ${styles.buttonSecondary}`}>
            Buy Ad Space
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;

