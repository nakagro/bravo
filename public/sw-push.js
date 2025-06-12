/* Service worker push event handler injected via importScripts */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
    console.log("[SW] Push received", data);
  } catch {
    data = { title: "Notification", body: event.data?.text() ?? "" };
  }

  const { title, body } = data;

  event.waitUntil(
    self.registration.showNotification(title || "Notification", {
      body,
      icon: "/icons/web-app-manifest-192x192.png",
      badge: "/icons/favicon-96x96.png",
    })
  );
});
