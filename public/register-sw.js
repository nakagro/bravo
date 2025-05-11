// Register the service worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // First, ensure we're authenticated by fetching the manifest with credentials
    fetch('/manifest.json', { credentials: 'include' })
      .then(response => {
        // Now register the service worker
        return navigator.serviceWorker.register('/sw.js');
      })
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
