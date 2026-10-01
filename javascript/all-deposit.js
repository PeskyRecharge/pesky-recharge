// =========================================================
// SUPABASE CLIENT INITIALIZATION
// =========================================================
const SUPABASE_URL = "https://beyykzogvaemjvecbzkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const depositTableBody = document.getElementById("depositTableBody");
const depositSearchInput = document.getElementById("depositSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const statusFilter = document.getElementById("statusFilter");
const methodFilter = document.getElementById("methodFilter");
const sortBy = document.getElementById("sortBy");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const recordCountInfo = document.getElementById("recordCountInfo");

// Metrics DOM Elements
const metricTotalVolume = document.getElementById("metricTotalVolume");
const metricTotalCount = document.getElementById("metricTotalCount");
const metricCompletedCount = document.getElementById("metricCompletedCount");
const metricPendingCount = document.getElementById("metricPendingCount");

// Pagination Controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPageDisplay");

// State
let rawDepositsDataset = [];
let customerMap = {}; // Maps auth_id/user_id to customer details
let filteredDepositsDataset = [];
let currentPage = 1;
const itemsPerPage = 10;

// =========================================================
// DATA FETCH ENGINE
// =========================================================
async function fetchDepositData() {
  renderLoadingState();

  try {
    // 1. Fetch all deposits ordered by creation time
    const { data: deposits, error: depositError } = await db
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false });

    if (depositError) throw depositError;

    // 2. Fetch customer registry to resolve user_id into names/emails
    const { data: customers } = await db.from("customers").select("*");
    if (customers) {
      customers.forEach((c) => {
        const full = `${c.surname || ""} ${c.other_name || ""}`.trim();
        customerMap[c.auth_id || c.id || c.user_id] = {
          name: full || "Unnamed Customer",
          email: c.email || "",
        };
      });
    }

    rawDepositsDataset = deposits || [];
    computeMetrics(rawDepositsDataset);
    applyFiltersAndSort();
  } catch (err) {
    console.error("[DepositModule] Data error:", err);
    renderErrorState(err.message);
  }
}

// =========================================================
// METRICS COMPUTATION
// =========================================================
function computeMetrics(deposits) {
  let totalVol = 0;
  let completedCnt = 0;
  let pendingCnt = 0;

  deposits.forEach((d) => {
    const amt = parseFloat(d.amount || 0);
    const status = (d.status || "").toLowerCase();

    if (status === "completed") {
      totalVol += amt;
      completedCnt++;
    } else {
      pendingCnt++;
    }
  });

  metricTotalVolume.innerText = `₦${totalVol.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  metricTotalCount.innerText = deposits.length.toLocaleString();
  metricCompletedCount.innerText = completedCnt.toLocaleString();
  metricPendingCount.innerText = pendingCnt.toLocaleString();
}

// =========================================================
// FILTERS & SORT ENGINE
// =========================================================
function applyFiltersAndSort() {
  const query = depositSearchInput.value.toLowerCase().trim();
  const selectedStatus = statusFilter.value;
  const selectedMethod = methodFilter.value;
  const selectedSort = sortBy.value;

  filteredDepositsDataset = rawDepositsDataset.filter((item) => {
    const ref = (item.reference || "").toLowerCase();
    const userId = (item.user_id || "").toLowerCase();
    const status = (item.status || "").toLowerCase();
    const method = (item.payment_method || "").toLowerCase();

    // Customer lookup match
    const custInfo = customerMap[item.user_id] || { name: "", email: "" };
    const custName = custInfo.name.toLowerCase();
    const custEmail = custInfo.email.toLowerCase();

    const matchesQuery =
      ref.includes(query) ||
      userId.includes(query) ||
      custName.includes(query) ||
      custEmail.includes(query);

    let matchesStatus = true;
    if (selectedStatus !== "all") matchesStatus = status === selectedStatus;

    let matchesMethod = true;
    if (selectedMethod !== "all") matchesMethod = method === selectedMethod;

    return matchesQuery && matchesStatus && matchesMethod;
  });

  // Sorting
  filteredDepositsDataset.sort((a, b) => {
    const amtA = parseFloat(a.amount || 0);
    const amtB = parseFloat(b.amount || 0);
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);

    if (selectedSort === "newest") return dateB - dateA;
    if (selectedSort === "oldest") return dateA - dateB;
    if (selectedSort === "amount_high") return amtB - amtA;
    if (selectedSort === "amount_low") return amtA - amtB;
    return 0;
  });

  currentPage = 1;
  renderPaginatedTable();
}

// =========================================================
// TABLE RENDER ENGINE
// =========================================================
function renderPaginatedTable() {
  const totalItems = filteredDepositsDataset.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalItems === 0) {
    depositTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="state-container">
          <div style="color: var(--text-secondary);">
            <i class="fa-solid fa-receipt" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>No deposit records matched your criteria.</p>
          </div>
        </td>
      </tr>`;
    updatePaginationUI(0, 0, 1, 1);
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentSlice = filteredDepositsDataset.slice(startIndex, endIndex);

  depositTableBody.innerHTML = currentSlice
    .map((item) => {
      const id = item.id || "--";
      const ref = item.reference || "N/A";
      const userId = item.user_id || "N/A";
      const custInfo = customerMap[userId];
      const displayName = custInfo ? custInfo.name : "System User";
      const amount = parseFloat(item.amount || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const method = (item.payment_method || "bank_transfer").replace("_", " ");
      const status = (item.status || "pending").toLowerCase();

      const created = item.created_at ? formatDate(item.created_at) : "N/A";
      const completed = item.completed_at ? formatDate(item.completed_at) : "N/A";

      let statusBadgeClass = "badge-pending";
      if (status === "completed") statusBadgeClass = "badge-completed";
      if (status === "failed") statusBadgeClass = "badge-failed";

      let methodIcon = "fa-building-columns";
      if (method.includes("card")) methodIcon = "fa-credit-card";
      if (method.includes("wallet")) methodIcon = "fa-wallet";

      return `
      <tr>
        <td><span class="deposit-id-tag">#${id}</span></td>
        <td><span class="ref-code">${sanitizeHTML(ref)}</span></td>
        <td>
          <div class="customer-cell">
            <span class="customer-name">${sanitizeHTML(displayName)}</span>
            <span class="user-uuid-sub">${sanitizeHTML(userId)}</span>
          </div>
        </td>
        <td class="amount-cell">₦${amount}</td>
        <td>
          <span class="method-tag">
            <i class="fa-solid ${methodIcon}"></i>
            ${sanitizeHTML(method)}
          </span>
        </td>
        <td>
          <span class="status-badge ${statusBadgeClass}">
            <i class="fa-solid fa-circle" style="font-size: 6px;"></i>
            ${sanitizeHTML(status)}
          </span>
        </td>
        <td>${created}</td>
        <td>${completed}</td>
      </tr>`;
    })
    .join("");

  updatePaginationUI(startIndex + 1, endIndex, totalItems, totalPages);
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updatePaginationUI(start, end, total, totalPages) {
  recordCountInfo.innerHTML = `Showing <strong>${start} - ${end}</strong> of <strong>${total}</strong> deposit records`;
  currentPageDisplay.innerText = `Page ${currentPage} of ${totalPages}`;

  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

function renderLoadingState() {
  depositTableBody.innerHTML = `
    <tr>
      <td colspan="8" class="state-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Fetching deposit logs from 'public.deposits'...</span>
        </div>
      </td>
    </tr>`;
}

function renderErrorState(msg) {
  depositTableBody.innerHTML = `
    <tr>
      <td colspan="8" class="state-container" style="color: var(--accent-red);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; margin-bottom: 12px;"></i>
        <p><strong>Failed to Load Deposit Data</strong></p>
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

// Event Listeners
depositSearchInput.addEventListener("input", () => {
  clearSearchBtn.classList.toggle("hidden", depositSearchInput.value.length === 0);
  applyFiltersAndSort();
});

clearSearchBtn.addEventListener("click", () => {
  depositSearchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFiltersAndSort();
});

statusFilter.addEventListener("change", applyFiltersAndSort);
methodFilter.addEventListener("change", applyFiltersAndSort);
sortBy.addEventListener("change", applyFiltersAndSort);

refreshDataBtn.addEventListener("click", () => {
  refreshDataBtn.querySelector("i").classList.add("fa-spin");
  fetchDepositData().finally(() => {
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
  const totalPages = Math.ceil(filteredDepositsDataset.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPaginatedTable();
  }
});

document.addEventListener("DOMContentLoaded", fetchDepositData);