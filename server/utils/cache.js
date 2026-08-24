/**
 * In-Memory Cache Utility (Zero Redis / Zero External Dependency)
 * Stores cache directly in Node.js memory with TTL expiration.
 * 100% free, fast, and works anywhere without external Redis servers.
 */
const memoryStore = new Map();

/**
 * Get a cached JSON value.
 * Returns null if not found or expired.
 */
async function getCache(key) {
  try {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  } catch {
    return null;
  }
}

/**
 * Set a cached JSON value with TTL in seconds.
 */
async function setCache(key, value, ttlSeconds = 300) {
  try {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  } catch {
    // silent
  }
}

/**
 * Delete a specific cache key.
 */
async function deleteCache(key) {
  try {
    memoryStore.delete(key);
  } catch {
    // silent
  }
}

/**
 * Delete all analytics cache keys (call after order create/update/cancel).
 */
async function invalidateAnalytics() {
  try {
    for (const key of memoryStore.keys()) {
      if (key.startsWith('analytics:')) {
        memoryStore.delete(key);
      }
    }
  } catch {
    // silent
  }
}

module.exports = { getCache, setCache, deleteCache, invalidateAnalytics };
