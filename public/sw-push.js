/* Service worker push event handler injected via importScripts */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
    console.log("[SW] Push received", data);
  } catch {
    data = { title: "Notification", body: event.data?.text() ?? "" };
  }

  const { title, body, url } = data;

  event.waitUntil(
    self.registration.showNotification(title || "Notification", {
      body,
      icon: "/icons/web-app-manifest-192x192.png",
      badge: "/icons/favicon-96x96.png",
      data: { url }, // Store URL in notification data for click handling
      requireInteraction: false, // Allow notification to auto-dismiss
      actions: url ? [
        {
          action: "open",
          title: "Open App",
          icon: "/icons/web-app-manifest-192x192.png"
        }
      ] : []
    })
  );
});

/* Handle notification clicks */
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked", event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || "/";
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with our app
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // Focus the existing window and navigate to the desired URL
          return client.focus().then(() => {
            return client.navigate(urlToOpen);
          });
        }
      }
      
      // If no existing window, open a new one
      return clients.openWindow(urlToOpen);
    })
  );
});
