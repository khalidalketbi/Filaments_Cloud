const originalFetch = globalThis.fetch.bind(globalThis);
const cache = new Map();

function isRefresh(url, options={}) {
  const u = String(url || '');
  const method = String(options.method || 'GET').toUpperCase();
  return method === 'POST' && u.includes('/auth/v1/token') && u.includes('grant_type=refresh_token');
}

function cacheKey(url, options={}) {
  return `${String(url)}|${String(options.body || '')}`;
}

globalThis.fetch = async function dedupedFetch(url, options={}) {
  if (!isRefresh(url, options)) return originalFetch(url, options);
  const key = cacheKey(url, options);
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && now - existing.at < 55000) {
    const response = await existing.promise;
    return response.clone();
  }
  const promise = originalFetch(url, options);
  cache.set(key, { at: now, promise });
  try {
    const response = await promise;
    if (!response.ok) cache.delete(key);
    return response.clone();
  } catch (e) {
    cache.delete(key);
    throw e;
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache) if (now - value.at > 60000) cache.delete(key);
}, 60000).unref?.();

console.log('Supabase auth request dedupe enabled');
