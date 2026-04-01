// Simple in-memory cache for demonstration
const cache = {};

function setCache(key, value, maxAgeSeconds = 60) {
  cache[key] = {
    value,
    expires: Date.now() + maxAgeSeconds * 1000
  };
}

function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

module.exports = { setCache, getCache };