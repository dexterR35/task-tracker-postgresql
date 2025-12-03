import { logger } from "@/utils/logger";

/**
 * Simple Data Cache for API Operations
 * Reduces redundant reads by caching static data
 */

class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
    this.monthCacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days for months (change once per month)
    this.staticDataTTL = Infinity; // Infinite cache for static data (users, reporters, deliverables, tasks)

    // Memory management
    this.maxCacheSize = 1000; // Maximum number of cache entries
    this.maxMemoryUsage = 50 * 1024 * 1024; // 50MB max memory usage
    this.cleanupThreshold = 0.8; // Clean up when 80% of limits are reached
  }

  /**
   * Set data in cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, data, ttl = this.defaultTTL) {
    // Check memory limits before adding
    this.checkMemoryLimits();

    const expiry = Date.now() + ttl;
    this.cache.set(key, data);
    this.cacheExpiry.set(key, expiry);

    // Add timestamp for static data cleanup
    if (ttl === Infinity && data && typeof data === 'object') {
      data.timestamp = Date.now();
    }
  }

  /**
   * Check memory limits and cleanup if necessary
   */
  checkMemoryLimits() {
    const cacheSize = this.cache.size;
    const memoryUsage = this.estimateMemoryUsage();

    // Check if we're approaching limits
    if (cacheSize > this.maxCacheSize * this.cleanupThreshold ||
        memoryUsage > this.maxMemoryUsage * this.cleanupThreshold) {
      this.performAggressiveCleanup();
    }
  }

  /**
   * Estimate memory usage of cache
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache.entries()) {
      totalSize += key.length * 2; // String length * 2 bytes
      totalSize += this.estimateObjectSize(value);
    }
    return totalSize;
  }

  /**
   * Estimate size of an object in bytes
   */
  estimateObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return obj.length * 2;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (Array.isArray(obj)) {
      return obj.reduce((size, item) => size + this.estimateObjectSize(item), 0);
    }
    if (typeof obj === 'object') {
      return Object.values(obj).reduce((size, value) => size + this.estimateObjectSize(value), 0);
    }
    return 0;
  }

  /**
   * Perform aggressive cleanup when memory limits are reached
   */
  performAggressiveCleanup() {
    logger.warn('[DataCache] Memory limits reached, performing aggressive cleanup');

    // Remove oldest entries first
    const entries = Array.from(this.cacheExpiry.entries())
      .sort(([,a], [,b]) => a - b);

    const entriesToRemove = Math.floor(this.cache.size * 0.3); // Remove 30% of entries

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      const [key] = entries[i];
      this.delete(key);
    }

    logger.log(`[DataCache] Aggressive cleanup removed ${entriesToRemove} entries`);
  }

  /**
   * Set month data with extended TTL (30 days - changes once per month)
   * @param {string} key - Cache key
   * @param {any} data - Month data to cache
   */
  setMonthData(key, data) {
    this.set(key, data, this.monthCacheTTL);
  }

  /**
   * Set static data with infinite cache (users, reporters, deliverables, tasks)
   * @param {string} key - Cache key
   * @param {any} data - Static data to cache
   */
  setStaticData(key, data) {
    this.set(key, data, this.staticDataTTL);
  }

  /**
   * Set tasks data with infinite cache (only changes when you add/edit/remove tasks)
   * @param {string} key - Cache key
   * @param {any} data - Tasks data to cache
   */
  setTasksData(key, data) {
    this.set(key, data, this.staticDataTTL);
  }

  /**
   * Force clear static data cache (when users/reporters/deliverables change)
   * @param {string} key - Cache key to clear
   */
  clearStaticData(key) {
    this.delete(key);
  }

  /**
   * Force clear tasks data cache (when tasks are added/edited/removed)
   * @param {string} key - Cache key to clear
   */
  clearTasksData(key) {
    this.delete(key);
  }

  /**
   * Force clear month data cache (when month changes)
   * @param {string} key - Cache key to clear
   */
  clearMonthData(key) {
    this.delete(key);
  }

  /**
   * Get month data with extended cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached month data or null if expired/not found
   */
  getMonthData(key) {
    return this.get(key);
  }

  /**
   * Get static data with extended cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached static data or null if expired/not found
   */
  getStaticData(key) {
    return this.get(key);
  }

  /**
   * Get data from cache if not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/not found
   */
  get(key) {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalKeys: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: this.cache.size
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        keysToDelete.push(key);
      }
    }

    // Delete expired entries
    keysToDelete.forEach(key => {
      this.delete(key);
    });

    // Also clean up static data that's too old (even though it has infinite TTL)
    this.cleanupOldStaticData();

    logger.log(`[DataCache] Cleaned up ${keysToDelete.length} expired entries`);
  }

  /**
   * Clean up old static data to prevent memory leaks
   */
  cleanupOldStaticData() {
    const now = Date.now();
    const maxStaticAge = 7 * 24 * 60 * 60 * 1000; // 7 days for static data
    const keysToDelete = [];

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      // Check if it's static data and too old
      if (expiry === Infinity && this.cache.has(key)) {
        const data = this.cache.get(key);
        if (data && data.timestamp && (now - data.timestamp) > maxStaticAge) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => {
      this.delete(key);
    });

    if (keysToDelete.length > 0) {
      logger.log(`[DataCache] Cleaned up ${keysToDelete.length} old static entries`);
    }
  }
}

// Create singleton instance
const dataCache = new DataCache();

// Clean up expired entries every 10 minutes
setInterval(() => {
  dataCache.cleanup();
}, 10 * 60 * 1000);

export default dataCache;

