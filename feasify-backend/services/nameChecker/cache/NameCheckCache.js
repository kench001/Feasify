/**
 * NameCheckCache
 * Lightweight in-memory cache with short TTL for government name checks.
 * Ensures fast responses without caching results indefinitely.
 */

class NameCheckCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.ttlMs = Number(process.env.NAME_CHECK_CACHE_TTL_MS) || defaultTtlMs;
    this.store = new Map();
  }

  _makeKey(provider, query) {
    const p = (provider || "").toUpperCase().trim();
    const q = (query || "").toLowerCase().trim();
    return `${p}:${q}`;
  }

  /**
   * Retrieves a cached result if not expired.
   * @param {string} provider
   * @param {string} query
   * @returns {Object|null}
   */
  get(provider, query) {
    const key = this._makeKey(provider, query);
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    return {
      ...entry.data,
      cached: true,
      cachedAt: new Date(entry.timestamp).toISOString()
    };
  }

  /**
   * Stores a result with current timestamp.
   * @param {string} provider
   * @param {string} query
   * @param {Object} data
   */
  set(provider, query, data) {
    const key = this._makeKey(provider, query);
    this.store.set(key, {
      timestamp: Date.now(),
      data: { ...data, cached: false }
    });

    // Prune occasionally when map gets large
    if (this.store.size > 500) {
      this.prune();
    }
  }

  delete(provider, query) {
    const key = this._makeKey(provider, query);
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }
}

module.exports = new NameCheckCache();
