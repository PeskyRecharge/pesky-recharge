const CACHE_NAME = "pesky-v5";

const ASSETS = [
  // ==========================================
  // HOME
  // ==========================================

  "/",
  "/index.html",
  "/css/index.css",
  "/javascript/index.js",


  // ==========================================
  // LOGIN
  // ==========================================

  "/login.html",
  "/css/login.css",
  "/javascript/login.js",


  // ==========================================
  // CREATE ACCOUNT
  // ==========================================

  "/create-account.html",
  "/css/create-account.css",
  "/javascript/create-account.js",


  // ==========================================
  // DEPOSIT
  // ==========================================

  "/user-deposit.html",
  "/css/user-deposit.css",
  "/javascript/user-deposit.js",


  // ==========================================
  // PURCHASE HISTORY
  // ==========================================

  "/purchase-history.html",
  "/css/history.css",
  "/javascript/history.js",


  // ==========================================
  // PURCHASE
  // ==========================================

  "/purchase.html",
  "/css/purchase.css",
  "/javascript/purchase.js",


  // ==========================================
  // DATA
  // ==========================================

  "/data.html",
  "/css/data.css",
  "/javascript/data.js",


  // ==========================================
  // AIRTIME
  // ==========================================

  "/airtime.html",
  "/css/airtime.css",
  "/javascript/airtime.js",


  // ==========================================
  // PROFILE
  // ==========================================

  "/profile.html",
  "/css/profile.css",
  "/javascript/profile.js",


  // ==========================================
  // ABOUT
  // ==========================================

  "/about.html",
  "/css/about.css",
  


  // ==========================================
  // LIVE CHARGE
  // ==========================================

  "/live-chat.html",
  "/css/live-chat.css",
  "/javascript/live-chat.js",


  // ==========================================
  // HELP
  // ==========================================

  "/help.html",
  "/css/help.css",
  


  // ==========================================
  // DASHBOARD
  // ==========================================

  "/dashboard.html",
  "/css/dashboard.css",
  "/javascript/dashboard.js",


  // ==========================================
  // USER TRANSACTION
  // ==========================================

  "/user-transaction.html",
  "/css/user-transaction.css",
  "/javascript/user-transaction.js",


  // ==========================================
  // NOTIFICATION CENTER
  // ==========================================

  "/notification-center.html",
  "/css/notification-center.css",
  "/javascript/notification-center.js",


  // ==========================================
  // FAQ
  // ==========================================

  "/faq.html",
  "/css/faq.css",
  "/javascript/faq.js",


  // ==========================================
  // CONTACT
  // ==========================================

  "/contact.html",
  "/css/contact.css",


  // ==========================================
  // TERMS
  // ==========================================

  "/terms.html",
  "/css/terms.css",


  // ==========================================
  // PRIVACY
  // ==========================================

  "/privacy.html",
  "/css/privacy.css",


  // ==========================================
  // SHARED JAVASCRIPT
  // ==========================================

  "/javascript/notifications.js",
  "/javascript/passkeys.js",


  // ==========================================
  // IMAGES & PWA
  // ==========================================

  "/img/pesky4.png",
  "/manifest.json"
];


// ==========================================
// INSTALL
// ==========================================

self.addEventListener("install", (event) => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then((cache) => {

        console.log(
          "[Service Worker] Caching static assets..."
        );

        return Promise.all(

          ASSETS.map((url) => {

            return cache.add(url)
              .catch((error) => {

                console.error(
                  `[Service Worker] Failed to cache: ${url}`,
                  error
                );

              });

          })

        );

      })

  );

  self.skipWaiting();
});


// ==========================================
// ACTIVATE
// ==========================================

self.addEventListener("activate", (event) => {

  event.waitUntil(

    caches.keys()
      .then((keys) => {

        return Promise.all(

          keys.map((key) => {

            if (key !== CACHE_NAME) {

              console.log(
                "[Service Worker] Removing old cache:",
                key
              );

              return caches.delete(key);

            }

          })

        );

      })

  );

  self.clients.claim();
});


// ==========================================
// FETCH
// ==========================================

self.addEventListener("fetch", (event) => {

  const requestUrl =
    new URL(event.request.url);


  // ========================================
  // DON'T CACHE POST REQUESTS
  // ========================================

  if (event.request.method !== "GET") {
    return;
  }


  // ========================================
  // DON'T CACHE SUPABASE
  // ========================================

  if (
    requestUrl.hostname.includes(
      "supabase.co"
    )
  ) {
    return;
  }


  // ========================================
  // DON'T CACHE PAYSTACK
  // ========================================

  if (
    requestUrl.hostname.includes(
      "paystack.co"
    )
  ) {
    return;
  }


  // ========================================
  // CACHE FIRST
  // ========================================

  event.respondWith(

    caches.match(event.request)
      .then((cachedResponse) => {

        if (cachedResponse) {
          return cachedResponse;
        }


        return fetch(event.request)
          .then((networkResponse) => {

            // Only cache successful responses
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type !== "opaque"
            ) {

              const responseClone =
                networkResponse.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {

                  cache.put(
                    event.request,
                    responseClone
                  );

                });

            }

            return networkResponse;

          });

      })

  );

});


// ====================================================
// SERVICE WORKER: Service Worker for Status Bar Notifications
// ====================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Display messages sent through the Web Push service.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "PESKY RECHARGE", {
    body: payload.body || payload.message || "You have a new notification.",
    icon: payload.icon || "/img/pesky4.png",
    badge: payload.badge || "/img/pesky4.png",
    data: { url: payload.url || "/notification-center.html" },
  }));
});

// When user taps/clicks the notification on phone bar or lock screen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Always route notification taps through the authenticated notification center.
  const targetUrl = new URL("/notification-center.html", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes("notification-center.html") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});