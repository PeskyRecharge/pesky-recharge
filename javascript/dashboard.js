//  Redirect when clicking mini balance (top bar)
const balanceMini = document.getElementById("balanceMini");
if (balanceMini) {
  balanceMini.addEventListener("click", () => {
    window.location.href = "deposit.html";
  });
}

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

let currentDashboardUser = null;
let dashboardBalance = 0;

// Same authenticated account and balance flow used by deposit.js
async function getDashboardUser() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      window.location.href = "login.html";
      return;
    }

    if (!data || !data.session || !data.session.user) {
      console.log("No active login session.");
      window.location.href = "login.html";
      return;
    }

    currentDashboardUser = data.session.user;
    await loadDashboardAccount();
  } catch (error) {
    console.error("Get user error:", error);
    window.location.href = "login.html";
  }
}

async function loadDashboardProfileName() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("first_name, other_name")
    .eq("auth_id", currentDashboardUser.id)
    .single();

  if (error || !data) {
    console.error("Dashboard name error:", error);
    return;
  }

  const dashboardUserNameEl = document.getElementById("dashboardUserName");
  const firstName = String(data.first_name || "").trim();
  const otherName = String(data.other_name || "").trim();
  const displayName = `${firstName} ${otherName}`.trim()
    || currentDashboardUser.user_metadata?.full_name
    || "Friend";

  if (dashboardUserNameEl) {
    dashboardUserNameEl.textContent = displayName.toUpperCase();
  }
}

async function loadDashboardAccount() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    window.location.href = "login.html";
    return;
  }

  currentDashboardUser = userData.user;

  const { data, error } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("auth_id", currentDashboardUser.id)
    .single();

  if (!error && data) {
    dashboardBalance = Number(data.balance || 0);
    updateDashboardBalance();
    await loadDashboardProfileName();
  } else {
    dashboardBalance = 0;
    updateDashboardBalance();
    console.error("Dashboard balance error:", error);
  }
}

function updateDashboardBalance() {
  const formattedBalance = `₦${Number(dashboardBalance || 0).toFixed(2)}`;
  const walletBalanceEl = document.getElementById("walletBalance");
  const balanceEl = document.getElementById("dashboardBalance");
  if (walletBalanceEl) walletBalanceEl.textContent = formattedBalance;
  if (balanceEl) balanceEl.textContent = formattedBalance;
}

//  Load balance and user info for dashboard
async function loadDashboardData() {
  await loadDashboardAccount();
}

//  Initialize data load
loadDashboardData();
setInterval(loadDashboardData, 10000);

//  Drawer behavior is initialized by the page-level handler in dashboard.html.
const menuToggle = document.getElementById("menuToggle");
const drawer = document.getElementById("drawer");

//  Close drawer when clicking outside
document.addEventListener("click", (event) => {
  if (drawer && drawer.classList.contains("open")) {
    const isClickInside = drawer.contains(event.target) || (menuToggle && menuToggle.contains(event.target));
    if (!isClickInside) {
      drawer.classList.remove("open");
      if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
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

let dashboardNotificationUserId = null;

async function requestNotificationPermissionOnLogin() {
  if (!("Notification" in window)) return;

  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!data?.user) return;
    dashboardNotificationUserId = data.user.id;

    const permissionWasNotSet = Notification.permission === "default";
    const permission = permissionWasNotSet
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== "granted") return;

    const pushPreferenceIsSet = window.notificationPreferenceIsSet(data.user.id, "push");
    if (!permissionWasNotSet && pushPreferenceIsSet && !window.notificationPreferenceEnabled(data.user.id, "push")) return;

    await window.PeskyNotifications.subscribeDeviceToPush(supabaseClient, data.user.id);
    if (!window.notificationPreferenceEnabled(data.user.id, "push")) {
      window.setNotificationsEnabled(data.user.id, "push", true);
      await window.PeskyNotifications.showAccountNotification("Notifications enabled", {
        body: "This device is ready to receive PESKY RECHARGE alerts.",
        tag: "notification-settings-confirmation",
      });
    }
  } catch (error) {
    console.error("Unable to register this device for push notifications:", error);
  }
}

// ====================================================
// 2. TRIGGER PHONE STATUS BAR ALERT
// ====================================================

function showStatusBarAlert(title, message) {
  if (!dashboardNotificationUserId || !notificationsEnabled(dashboardNotificationUserId, "activity")) return;
  window.PeskyNotifications.showAccountNotification(title || "New Alert", {
    body: message || "Tap to read full notification",
    tag: "supabase-notif",
  });
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