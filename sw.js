const CACHE_NAME = "pesky-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/css/index.css",
  "/javascript/index.js",

  // Login Pages & Assets
  "/login.html",
  "/css/login.css",
  "/javascript/login.js",

  // Account Creation Pages & Assets
  "/create-account.html",
  "/css/create-account.css",
  "/javascript/create-account.js",

  // Static Auxiliary Pages
  "/contact.html",
  "/css/contact.css",

  "/terms.html",
  "/css/terms.css",

  "/privacy.html",
  "/css/privacy.css",

  // Shared JS & Images
  "/javascript/notifications.js",
  "/img/pesky4.png",
  "/manifest.json"
];

// 1. Install Event: Cache files safely
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching all static assets...");
      return Promise.all(
        ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.error(`[Service Worker] Failed to cache: ${url}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch Event: Serve cached static assets, allow live network for APIs
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass cache for POST requests or external APIs (like Supabase)
  if (
    event.request.method !== "GET" ||
    requestUrl.hostname.includes("supabase.co")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((networkResponse) => {
          // Dynamically cache valid HTTP GET requests
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
      );
    })
  );
});