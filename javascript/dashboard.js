//  Redirect when clicking mini balance (top bar)
document.getElementById("balanceMini").addEventListener("click", () => {
  window.location.href = "deposit.html";
});

//  Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const dashboardGreetingKey = "pesky-dashboard-greeting-done";

function hasDashboardGreetingAlreadyPlayed() {
  try {
    return sessionStorage.getItem(dashboardGreetingKey) === "true";
  } catch (error) {
    console.warn("Session storage unavailable:", error);
    return false;
  }
}

function markDashboardGreetingPlayed() {
  try {
    sessionStorage.setItem(dashboardGreetingKey, "true");
  } catch (error) {
    console.warn("Unable to store greeting state:", error);
  }
}

//  Speak helper using Web Speech API
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-US";   // language/accent
  msg.pitch = 1;        // normal pitch
  msg.rate = 1;         // normal speed
  window.speechSynthesis.speak(msg);
}

//  Load balance and user info for dashboard
async function loadDashboardData() {
  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("User not logged in:", userError);
      return;
    }

    const { data, error } = await supabaseClient
      .from("customers")
      .select("other_name, balance")
      .eq("auth_id", userData.user.id)
      .single();

    if (error) {
      console.error("Customer load error:", error.message, error.details);
      return;
    }

    if (data) {
      //  Update balance display
      const balanceEl = document.getElementById("dashboardBalance");
      if (balanceEl) {
        balanceEl.textContent = `₦${data.balance || 0}`;
      }

      //  Speak greeting, sales pitch, and balance once per login session
      const name = data.other_name || "Friend";
      const balance = data.balance || 0;

      if (!hasDashboardGreetingAlreadyPlayed()) {
        // Greeting
        speak(`Welcome to your dashboard, ${name}.`);

        // Sales pitch
        speak(
          "We sell recharge card pins for all networks: MTN, Glo, Airtel, and 9mobile, at affordable prices. " +
          "Our offers are: 100 naira recharge card for 98 point 50 kobo, 200 naira for 197  kobo, " +
          "500 naira for 492 point 5 kobo, and 1000 naira for 985  kobo. " +
          "Thank you for using Pesky Recharge. You can chat with us anytime for clarification."
        );

        // Current balance
        speak(`Your current balance is ₦${balance}.`);

        markDashboardGreetingPlayed();
      }
    }
  } catch (err) {
    console.error("Unexpected error loading dashboard data:", err);
  }
}

//  Initialize data load
loadDashboardData();
setInterval(loadDashboardData, 10000);

//  Drawer toggle logic
const menuToggle = document.getElementById("menuToggle");
const drawer = document.getElementById("drawer");

menuToggle.addEventListener("click", () => {
  drawer.classList.toggle("open");
});

//  Close drawer when clicking outside
document.addEventListener("click", (event) => {
  if (drawer.classList.contains("open")) {
    const isClickInside = drawer.contains(event.target) || menuToggle.contains(event.target);
    if (!isClickInside) {
      drawer.classList.remove("open");
    }
  }
});

//  Logout button logic
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      sessionStorage.removeItem(dashboardGreetingKey);
    } catch (error) {
      console.warn("Unable to clear greeting state:", error);
    }

    await supabaseClient.auth.signOut({ scope: "global" });
    window.location.href = "index.html";
  });
}

//  Hero slider logic
const slides = document.querySelectorAll(".hero-slider .slide");
let currentSlide = 0;

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.classList.remove("active");
    if (i === index) slide.classList.add("active");
  });
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
}

// Change slide every 4 seconds
setInterval(nextSlide, 4000);



// ====================================================
// 1. REGISTER SERVICE WORKER & REQUEST PERMISSION
// ====================================================

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.error("SW registration error:", err));
}

// Call this when user signs up or logs into dashboard
async function requestNotificationPermissionOnLogin() {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Show confirmation alert on status bar
      showStatusBarAlert(
        "Notifications Enabled!",
        "You will now receive updates on your phone status bar."
      );
    }
  }
}



// ====================================================
// 1. REGISTER SERVICE WORKER & REQUEST PERMISSION
// ====================================================

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.error("SW registration error:", err));
}

// Call this when user signs up or logs into dashboard
async function requestNotificationPermissionOnLogin() {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Show confirmation alert on status bar
      showStatusBarAlert(
        "Notifications Enabled!",
        "You will now receive updates on your phone status bar."
      );
    }
  }
}

// ====================================================
// 2. TRIGGER PHONE STATUS BAR ALERT
// ====================================================

function showStatusBarAlert(title, message) {
  if ("Notification" in window && Notification.permission === "granted") {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title || "New Alert", {
          body: message || "Tap to read full notification",
          icon: "/icon.png",          // Replace with your icon path
          badge: "/badge.png",        // Replace with small status bar icon path
          vibrate: [200, 100, 200],
          tag: "supabase-notif"
        });
      });
    } else {
      new Notification(title || "New Alert", {
        body: message || "Tap to read full notification"
      });
    }
  }
}

// ====================================================
// 3. LISTEN FOR NEW NOTIFICATIONS FROM SUPABASE
// ====================================================

const notificationReadStorageKey = "user_read_notifications_ids";
const notificationCountBadge = document.getElementById("notificationCountBadge");

async function updateNotificationCount() {
  if (!notificationCountBadge) return;

  try {
    const { data, error } = await supabaseClient
      .from("notifications")
      .select("title, created_at");

    if (error) throw error;

    const readIds = JSON.parse(localStorage.getItem(notificationReadStorageKey) || "[]");
    const unreadCount = (data || []).filter((item) =>
      !readIds.includes(`${item.title}_${item.created_at}`)
    ).length;

    notificationCountBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    notificationCountBadge.hidden = unreadCount === 0;
  } catch (error) {
    console.error("Unable to update notification count:", error);
  }
}

function listenForNewNotifications() {
  supabaseClient
    .channel("public:notifications")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        const newNotif = payload.new;
        // Post directly to phone status bar / lock screen
        showStatusBarAlert(newNotif.title, newNotif.message);
        updateNotificationCount();
      }
    )
    .subscribe();
}

window.addEventListener("storage", (event) => {
  if (event.key === notificationReadStorageKey) {
    updateNotificationCount();
  }
});

// Initialize on Dashboard Load
document.addEventListener("DOMContentLoaded", () => {
  requestNotificationPermissionOnLogin();
  listenForNewNotifications();
  updateNotificationCount();
});



// ============================================
// PWA INSTALL BANNER CONTROLLER (WITH SKIP/DISMISS)
// ============================================

let deferredPrompt;
const pwaBanner = document.getElementById("pwaBannerContainer");
const installBtn = document.getElementById("pwaInstallBtn");
const closeBtn = document.getElementById("pwaCloseBtn");

// Check if running inside installed standalone PWA
const isInstalled = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

if (pwaBanner && isInstalled) {
  pwaBanner.style.display = "none";
}

// 1. Listen for browser PWA prompt event
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Don't show if already installed OR if user clicked Skip previously
  const userSkipped = localStorage.getItem("pwaBannerSkipped");

  if (pwaBanner && !isInstalled && !userSkipped) {
    pwaBanner.style.display = "flex";
  }
});

// 2. Handle Install Button Click
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      window.alert("To install PESKY RECHARGE, open your browser menu and choose Install app or Add to Home Screen.");
      return;
    }

    // Show native browser install prompt
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install Choice: ${outcome}`);

    deferredPrompt = null;

    // Hide banner on completion
    if (pwaBanner) {
      pwaBanner.style.display = "none";
    }
  });
}

// 3. Handle Skip / Dismiss Click
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    if (pwaBanner) {
      pwaBanner.style.display = "none";
      // Remember that the user skipped it so it won't keep annoying them
      localStorage.setItem("pwaBannerSkipped", "true");
    }
  });
}

// 4. Automatically hide if app is installed
window.addEventListener("appinstalled", () => {
  console.log("App was successfully installed!");
  if (pwaBanner) {
    pwaBanner.style.display = "none";
  }
});