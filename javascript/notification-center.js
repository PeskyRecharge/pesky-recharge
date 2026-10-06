// ============================================
// SUPABASE CONFIGURATION
// ============================================
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Local variables
let notificationsList = [];
let currentFilter = "all";
const READ_STORAGE_KEY = "user_read_notifications_ids";

// ============================================
// DOM ELEMENTS
// ============================================
const notificationsListEl = document.getElementById("notificationsList");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const totalBadge = document.getElementById("totalBadge");
const unreadBadge = document.getElementById("unreadBadge");
const tabButtons = document.querySelectorAll(".tab-btn");

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  requireAuthenticatedUser();
});

async function requireAuthenticatedUser() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
      redirectToLogin();
      return;
    }

    fetchNotifications();
    setupRealtimeSubscription();
    setupEventListeners();
  } catch (error) {
    console.error("Unable to verify notification access:", error);
    redirectToLogin();
  }
}

function redirectToLogin() {
  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`login.html?redirect=${encodeURIComponent(returnPath)}`);
}

// ============================================
// FETCH FROM SUPABASE
// ============================================
async function fetchNotifications() {
  try {
    const { data, error } = await supabaseClient
      .from("notifications")
      .select("title, message, created_at, created_by")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading notifications:", error);
      notificationsListEl.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Failed to load notifications. Check database connection.</p>
        </div>
      `;
      return;
    }

    notificationsList = data || [];
    renderPage();
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

// ============================================
// REALTIME LISTENER
// ============================================
function setupRealtimeSubscription() {
  supabaseClient
    .channel("public:notifications")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        // Automatically append new notifications live
        notificationsList.unshift(payload.new);
        renderPage();
      }
    )
    .subscribe();
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================
function renderPage() {
  const readIds = getReadIds();

  // Filter lists
  const unreadItems = notificationsList.filter(
    (item) => !readIds.includes(getItemKey(item))
  );

  // Update counts
  totalBadge.textContent = notificationsList.length;
  unreadBadge.textContent = unreadItems.length;

  // Filter based on active tab
  let filteredList = notificationsList;
  if (currentFilter === "unread") {
    filteredList = unreadItems;
  }

  // Handle Empty States
  if (filteredList.length === 0) {
    notificationsListEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-bell-slash"></i>
        <p>${currentFilter === "unread" ? "No unread notifications!" : "No notifications available."}</p>
      </div>
    `;
    return;
  }

  // Render cards
  notificationsListEl.innerHTML = filteredList
    .map((item) => {
      const itemKey = getItemKey(item);
      const isUnread = !readIds.includes(itemKey);

      return `
        <div class="notif-card ${isUnread ? "unread" : ""}" onclick="markAsRead('${itemKey}')">
          <div class="notif-icon">
            <i class="fa-solid fa-bell"></i>
          </div>
          <div class="notif-body">
            <div class="notif-title">${escapeHtml(item.title || "Notification")}</div>
            <div class="notif-message">${escapeHtml(item.message || "")}</div>
            <div class="notif-meta">
              <span><i class="fa-regular fa-clock"></i> ${timeAgo(item.created_at)}</span>
            </div>
          </div>
          ${isUnread ? '<span class="unread-dot"></span>' : ""}
        </div>
      `;
    })
    .join("");
}

// Key generator since table uses title + timestamp
function getItemKey(item) {
  return `${item.title}_${item.created_at}`;
}

// Read Tracker
function getReadIds() {
  const stored = localStorage.getItem(READ_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function markAsRead(itemKey) {
  const readIds = getReadIds();
  if (!readIds.includes(itemKey)) {
    readIds.push(itemKey);
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds));
    renderPage();
  }
}

function markAllAsRead() {
  const allKeys = notificationsList.map((item) => getItemKey(item));
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(allKeys));
  renderPage();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Mark all read button
  markAllReadBtn.addEventListener("click", markAllAsRead);

  // Tab filtering
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      const target = e.currentTarget;
      target.classList.add("active");
      currentFilter = target.getAttribute("data-filter");
      renderPage();
    });
  });
}

// ============================================
// UTILITIES
// ============================================
function timeAgo(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}