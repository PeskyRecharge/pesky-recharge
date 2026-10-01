// =========================================================
// SUPABASE SDK CONFIGURATION
// =========================================================
const SUPABASE_URL = "https://beyykzogvaemjvecbzkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const userTableBody = document.getElementById("userTableBody");
const userSearchInput = document.getElementById("userSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const statusFilter = document.getElementById("statusFilter");
const sortBy = document.getElementById("sortBy");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const recordCountInfo = document.getElementById("recordCountInfo");

// Metric DOM Elements
const metricTotalUsers = document.getElementById("metricTotalUsers");
const metricActiveUsers = document.getElementById("metricActiveUsers");
const metricTotalBalance = document.getElementById("metricTotalBalance");
const metricSuspendedUsers = document.getElementById("metricSuspendedUsers");

// Pagination Controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPageDisplay");

// State
let rawUsersDataset = [];
let filteredUsersDataset = [];
let currentPage = 1;
const itemsPerPage = 10;

// =========================================================
// DATA FETCH ENGINE (Targeting 'customers')
// =========================================================
async function loadUserRecords() {
  renderLoadingState();

  try {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    rawUsersDataset = data || [];
    computeMetrics(rawUsersDataset);
    applyFiltersAndSort();
  } catch (err) {
    console.error("[UserModule] Data retrieval error:", err);
    renderErrorState(err.message);
  }
}

// =========================================================
// METRICS CALCULATOR
// =========================================================
function computeMetrics(users) {
  const total = users.length;
  let activeCount = 0;
  let suspendedCount = 0;
  let aggregateBalance = 0;

  users.forEach((u) => {
    const isSuspended = u.status === "suspended" || u.is_suspended === true;
    if (isSuspended) {
      suspendedCount++;
    } else {
      activeCount++;
    }

    const val = parseFloat(u.balance || 0);
    aggregateBalance += isNaN(val) ? 0 : val;
  });

  metricTotalUsers.innerText = total.toLocaleString();
  metricActiveUsers.innerText = activeCount.toLocaleString();
  metricSuspendedUsers.innerText = suspendedCount.toLocaleString();
  metricTotalBalance.innerText = `₦${aggregateBalance.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// =========================================================
// FILTERS & SORT ENGINE
// =========================================================
function applyFiltersAndSort() {
  const query = userSearchInput.value.toLowerCase().trim();
  const selectedStatus = statusFilter.value;
  const selectedSort = sortBy.value;

  filteredUsersDataset = rawUsersDataset.filter((user) => {
    const fullName = `${user.surname || ''} ${user.other_name || ''}`.trim().toLowerCase();
    const email = (user.email || "").toLowerCase();
    const phone = (user.phone_number || user.phone || "").toLowerCase();
    const userId = (user.user_id || "").toLowerCase();

    const matchesQuery =
      fullName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      userId.includes(query);

    const isSuspended = user.status === "suspended" || user.is_suspended === true;

    let matchesStatus = true;
    if (selectedStatus === "active") matchesStatus = !isSuspended;
    if (selectedStatus === "suspended") matchesStatus = isSuspended;

    return matchesQuery && matchesStatus;
  });

  filteredUsersDataset.sort((a, b) => {
    const balA = parseFloat(a.balance || 0);
    const balB = parseFloat(b.balance || 0);
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);

    if (selectedSort === "newest") return dateB - dateA;
    if (selectedSort === "oldest") return dateA - dateB;
    if (selectedSort === "balance_high") return balB - balA;
    if (selectedSort === "balance_low") return balA - balB;
    return 0;
  });

  currentPage = 1;
  renderPaginatedTable();
}

// =========================================================
// TABLE RENDERER
// =========================================================
function renderPaginatedTable() {
  const totalItems = filteredUsersDataset.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalItems === 0) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="state-container">
          <div style="color: var(--text-secondary);">
            <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>No customer records found.</p>
          </div>
        </td>
      </tr>`;
    updatePaginationUI(0, 0, 1, 1);
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentSlice = filteredUsersDataset.slice(startIndex, endIndex);

  userTableBody.innerHTML = currentSlice
    .map((user) => {
      const surname = user.surname || '';
      const otherName = user.other_name || '';
      const fullName = `${surname} ${otherName}`.trim() || "Unnamed Customer";
      
      const email = user.email || "No Email";
      const phone = user.phone_number || "N/A";
      const balance = parseFloat(user.balance || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const isSuspended = user.status === "suspended" || user.is_suspended === true;
      const initial = surname ? surname.charAt(0).toUpperCase() : "C";
      const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "N/A";

      return `
      <tr>
        <td>
          <div class="user-identity-cell">
            <div class="user-avatar">${initial}</div>
            <div class="user-meta-info">
              <span class="user-full-name">${sanitizeHTML(fullName)}</span>
              <span class="user-email-address">${sanitizeHTML(email)}</span>
            </div>
          </div>
        </td>
        <td>${sanitizeHTML(phone)}</td>
        <td class="wallet-balance-cell">₦${balance}</td>
        <td>
          <span class="status-badge ${
            isSuspended ? "badge-suspended" : "badge-active"
          }">
            <i class="fa-solid fa-circle" style="font-size: 6px;"></i>
            ${isSuspended ? "Suspended" : "Active"}
          </span>
        </td>
        <td>${joinedDate}</td>
        <td class="text-right">
          <button class="action-icon-btn" title="Inspect" onclick="inspectUser('${user.id}')">
            <i class="fa-solid fa-sliders"></i>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  updatePaginationUI(startIndex + 1, endIndex, totalItems, totalPages);
}

function updatePaginationUI(start, end, total, totalPages) {
  recordCountInfo.innerHTML = `Showing <strong>${start} - ${end}</strong> of <strong>${total}</strong> customers`;
  currentPageDisplay.innerText = `Page ${currentPage} of ${totalPages}`;

  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

function renderLoadingState() {
  userTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="state-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Fetching records from 'customers'...</span>
        </div>
      </td>
    </tr>`;
}

function renderErrorState(msg) {
  userTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="state-container" style="color: var(--accent-red);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; margin-bottom: 12px;"></i>
        <p><strong>Failed to Load Data</strong></p>
        <span style="font-size: 0.8rem; opacity: 0.8;">${sanitizeHTML(msg)}</span>
      </td>
    </tr>`;
}

function sanitizeHTML(str) {
  return String(str).replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[match])
  );
}

function inspectUser(id) {
  alert(`Selected Customer ID: ${id}`);
}

// Listeners
userSearchInput.addEventListener("input", () => {
  clearSearchBtn.classList.toggle("hidden", userSearchInput.value.length === 0);
  applyFiltersAndSort();
});

clearSearchBtn.addEventListener("click", () => {
  userSearchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFiltersAndSort();
});

statusFilter.addEventListener("change", applyFiltersAndSort);
sortBy.addEventListener("change", applyFiltersAndSort);

refreshDataBtn.addEventListener("click", () => {
  refreshDataBtn.querySelector("i").classList.add("fa-spin");
  loadUserRecords().finally(() => {
    setTimeout(() => refreshDataBtn.querySelector("i").classList.remove("fa-spin"), 600);
  });
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderPaginatedTable();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredUsersDataset.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPaginatedTable();
  }
});

document.addEventListener("DOMContentLoaded", loadUserRecords);