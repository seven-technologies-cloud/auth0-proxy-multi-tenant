/**
 * In-memory token cache with TTL and automatic refresh
 * Refreshes tokens 60 seconds before expiry
 */
class TokenCache {
  constructor() {
    this.cache = new Map();
    this.REFRESH_BUFFER_SECONDS = 60;
  }

  /**
   * Set a token in the cache with expiry time
   * @param {string} key - Cache key
   * @param {string} token - JWT token
   * @param {number} expiresIn - Token expiry in seconds
   */
  set(key, token, expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    const refreshTime = expiryTime - (this.REFRESH_BUFFER_SECONDS * 1000);
    
    this.cache.set(key, {
      token,
      expiryTime,
      refreshTime,
    });
  }

  /**
   * Get a token from the cache
   * @param {string} key - Cache key
   * @returns {string|null} - Token if valid and not expired, null otherwise
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Token has expired, remove from cache
    if (now >= entry.expiryTime) {
      this.cache.delete(key);
      return null;
    }

    return entry.token;
  }

  /**
   * Check if a token needs refresh (within refresh buffer)
   * @param {string} key - Cache key
   * @returns {boolean} - True if token needs refresh
   */
  needsRefresh(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return true;
    }

    const now = Date.now();
    return now >= entry.refreshTime;
  }

  /**
   * Remove a token from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all tokens from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      validEntries: entries.filter(entry => now < entry.expiryTime).length,
      expiredEntries: entries.filter(entry => now >= entry.expiryTime).length,
      needingRefresh: entries.filter(entry => now >= entry.refreshTime && now < entry.expiryTime).length,
    };
  }
}

export default new TokenCache();