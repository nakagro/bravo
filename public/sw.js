// Minimal service worker for PWA installability with Cloudflare Access support
const CACHE_NAME = 'wvfb-pwa-v1';

// This empty array means we're not caching anything
// We're just providing a service worker for installability
const urlsToCache = [];

// Install event - create cache but don't add anything to it
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  // Skip waiting to make the new service worker active immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => {
          return name !== CACHE_NAME;
        }).map((name) => {
          return caches.delete(name);
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - network-first strategy with credentials
// This means we always try the network first with credentials included,
// which is important for Cloudflare Access authentication
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests except for manifest.json
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.endsWith('manifest.json')) {
    return;
  }
  
  // For API requests (to Convex), always go to network
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('convex') || 
      event.request.url.includes('/_convex/')) {
    return;
  }

  // For all other requests, try network first with credentials, fall back to cache
  event.respondWith(
    fetch(event.request, { 
      credentials: 'include' // Include cookies and authentication headers
    }).catch(() => {
      // Only return from cache if network fails
      return caches.match(event.request);
    })
  );
});
