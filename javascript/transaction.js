// =========================================================
// SUPABASE CLIENT CONFIGURATION
// =========================================================
const SUPABASE_URL = "https://beyykzogvaemjvecbzkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const txTableBody = document.getElementById("txTableBody");
const txSearchInput = document.getElementById("txSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const typeFilter = document.getElementById("typeFilter");
const networkFilter = document.getElementById("networkFilter");
const statusFilter = document.getElementById("statusFilter");
const sortBy = document.getElementById("sortBy");
const refreshTxBtn = document.getElementById("refreshTxBtn");
const recordCountInfo = document.getElementById("recordCountInfo");

// Metric DOM Elements
const metricTotalTx = document.getElementById("metricTotalTx");
const metricTotalVolume = document.getElementById("metricTotalVolume");
const metricChargedVolume = document.getElementById("metricChargedVolume");
const metricTypeSplit = document.getElementById("metricTypeSplit");

// Pagination Elements
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPageDisplay");

// Modal Elements
const txModal = document.getElementById("txModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalContent = document.getElementById("modalContent");

// Internal State
let rawTxDataset = [];
let filteredTxDataset = [];
let currentPage = 1;
const itemsPerPage = 10;

// =========================================================
// DATA FETCHING ENGINE
// =========================================================
async function fetchPurchaseTransactions() {
  renderLoadingState();

  try {
    const { data, error } = await db
      .from("purchase_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    rawTxDataset = data || [];
    computeMetrics(rawTxDataset);
    applyFiltersAndSort();
  } catch (err) {
    console.error("[TransactionsModule] Error fetching data:", err);
    renderErrorState(err.message);
  }
}

// =========================================================
// METRICS ENGINE
// =========================================================
function computeMetrics(dataset) {
  const total = dataset.length;
  let faceSum = 0;
  let chargedSum = 0;
  let airtimeCount = 0;
  let dataCount = 0;

  dataset.forEach((tx) => {
    const amt = parseFloat(tx.amount || 0);
    const charged = parseFloat(tx.charged_amount || 0);

    faceSum += isNaN(amt) ? 0 : amt;
    chargedSum += isNaN(charged) ? 0 : charged;

    const pType = (tx.purchase_type || "").toLowerCase();
    if (pType === "airtime") airtimeCount++;
    if (pType === "data") dataCount++;
  });

  metricTotalTx.innerText = total.toLocaleString();
  metricTotalVolume.innerText = `₦${faceSum.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  metricChargedVolume.innerText = `₦${chargedSum.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  metricTypeSplit.innerText = `${airtimeCount} Airtime / ${dataCount} Data`;
}

// =========================================================
// FILTER & SORT ENGINE
// =========================================================
function applyFiltersAndSort() {
  const query = txSearchInput.value.toLowerCase().trim();
  const selectedType = typeFilter.value;
  const selectedNetwork = networkFilter.value;
  const selectedStatus = statusFilter.value;
  const selectedSort = sortBy.value;

  filteredTxDataset = rawTxDataset.filter((item) => {
    const phone = (item.phone_number || "").toLowerCase();
    const providerRef = (item.provider_reference || "").toLowerCase();
    const bundle = (item.data_bundle || "").toLowerCase();
    const userId = (item.user_id || "").toLowerCase();
    const primaryId = (item.id || "").toLowerCase();
    const planId = (item.data_plan_id || "").toLowerCase();

    const matchesQuery =
      phone.includes(query) ||
      providerRef.includes(query) ||
      bundle.includes(query) ||
      userId.includes(query) ||
      primaryId.includes(query) ||
      planId.includes(query);

    let matchesType = true;
    if (selectedType !== "all") {
      matchesType = (item.purchase_type || "").toLowerCase() === selectedType;
    }

    let matchesNetwork = true;
    if (selectedNetwork !== "all") {
      matchesNetwork = (item.network || "").toUpperCase() === selectedNetwork.toUpperCase();
    }

    let matchesStatus = true;
    if (selectedStatus !== "all") {
      matchesStatus = (item.status || "").toLowerCase() === selectedStatus;
    }

    return matchesQuery && matchesType && matchesNetwork && matchesStatus;
  });

  // Sorting
  filteredTxDataset.sort((a, b) => {
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
  const totalItems = filteredTxDataset.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalItems === 0) {
    txTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="state-container">
          <div style="color: var(--text-secondary);">
            <i class="fa-solid fa-receipt" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>No purchase transactions found matching the filter criteria.</p>
          </div>
        </td>
      </tr>`;
    updatePaginationUI(0, 0, 1, 1);
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentSlice = filteredTxDataset.slice(startIndex, endIndex);

  txTableBody.innerHTML = currentSlice
    .map((item) => {
      const pType = (item.purchase_type || "N/A").toLowerCase();
      const network = (item.network || "N/A").toUpperCase();
      const phone = item.phone_number || "N/A";
      const providerRef = item.provider_reference || "N/A";
      const status = (item.status || "completed").toLowerCase();

      const faceAmt = parseFloat(item.amount || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const chargedAmt = parseFloat(item.charged_amount || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      let bundleDisplay = "N/A";
      if (pType === "data") {
        if (item.data_bundle) {
          bundleDisplay = item.data_bundle;
        } else if (item.data_size && item.data_unit) {
          bundleDisplay = `${item.data_size} ${item.data_unit}`;
        }
      } else {
        bundleDisplay = "Airtime Top-up";
      }

      const txDate = item.created_at
        ? new Date(item.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : "N/A";

      // Network Badge Helper
      let netClass = "net-default";
      if (network.includes("MTN")) netClass = "net-mtn";
      else if (network.includes("GLO")) netClass = "net-glo";
      else if (network.includes("AIRTEL")) netClass = "net-airtel";
      else if (network.includes("9MOBILE")) netClass = "net-9mobile";

      return `
      <tr>
        <td>
          <span class="type-badge ${pType === 'data' ? 'type-data' : 'type-airtime'}">
            <i class="fa-solid ${pType === 'data' ? 'fa-wifi' : 'fa-mobile-screen'}"></i>
            ${sanitizeHTML(pType)}
          </span>
          <span class="network-tag ${netClass}">${sanitizeHTML(network)}</span>
        </td>
        <td class="phone-cell">${sanitizeHTML(phone)}</td>
        <td class="amount-cell">₦${faceAmt}</td>
        <td class="charged-cell">₦${chargedAmt}</td>
        <td>
          <span title="${sanitizeHTML(bundleDisplay)}" style="font-weight:600;">
            ${sanitizeHTML(truncateText(bundleDisplay, 28))}
          </span>
        </td>
        <td><span class="ref-code">${sanitizeHTML(providerRef)}</span></td>
        <td>
          <span class="status-badge status-${status}">
            <i class="fa-solid ${status === 'completed' ? 'fa-check-circle' : 'fa-clock'}"></i>
            ${sanitizeHTML(status)}
          </span>
        </td>
        <td style="font-size: 0.82rem; color: var(--text-secondary);">${txDate}</td>
        <td class="text-right">
          <button class="action-icon-btn" title="Inspect Full Record" onclick="openTxDetailsModal('${item.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  updatePaginationUI(startIndex + 1, endIndex, totalItems, totalPages);
}

function updatePaginationUI(start, end, total, totalPages) {
  recordCountInfo.innerHTML = `Showing <strong>${start} - ${end}</strong> of <strong>${total}</strong> records`;
  currentPageDisplay.innerText = `Page ${currentPage} of ${totalPages}`;

  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

function renderLoadingState() {
  txTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="state-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Querying 'purchase_transactions' table...</span>
        </div>
      </td>
    </tr>`;
}

function renderErrorState(msg) {
  txTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="state-container" style="color: var(--accent-red);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; margin-bottom: 12px;"></i>
        <p><strong>Failed to Fetch Transactions</strong></p>
        <span style="font-size: 0.8rem; opacity: 0.8;">${sanitizeHTML(msg)}</span>
      </td>
    </tr>`;
}

// =========================================================
// MODAL ENGINE FOR DETAILED INSPECTION
// =========================================================
window.openTxDetailsModal = function (id) {
  const tx = rawTxDataset.find((t) => t.id === id);
  if (!tx) return;

  const faceAmt = parseFloat(tx.amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const chargedAmt = parseFloat(tx.charged_amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  modalContent.innerHTML = `
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Transaction ID (UUID)</span>
        <span class="info-val">${sanitizeHTML(tx.id || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">User ID (UUID)</span>
        <span class="info-val">${sanitizeHTML(tx.user_id || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Purchase Type</span>
        <span class="info-val" style="text-transform:uppercase;">${sanitizeHTML(tx.purchase_type || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Network Provider</span>
        <span class="info-val">${sanitizeHTML(tx.network || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Recipient Phone Number</span>
        <span class="info-val">${sanitizeHTML(tx.phone_number || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Status</span>
        <span class="info-val text-green" style="text-transform:capitalize;">${sanitizeHTML(tx.status || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Face Value Amount</span>
        <span class="info-val">₦${faceAmt}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Charged Amount</span>
        <span class="info-val text-green">₦${chargedAmt}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data Bundle Description</span>
        <span class="info-val">${sanitizeHTML(tx.data_bundle || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data Plan ID</span>
        <span class="info-val">${sanitizeHTML(tx.data_plan_id || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data Size & Unit</span>
        <span class="info-val">${tx.data_size ? `${tx.data_size}${tx.data_unit || ''}` : 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Validity</span>
        <span class="info-val">${sanitizeHTML(tx.validity || 'N/A')}</span>
      </div>
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Provider Reference Code</span>
        <span class="info-val text-cyan" style="font-family:monospace;">${sanitizeHTML(tx.provider_reference || 'N/A')}</span>
      </div>
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Timestamp</span>
        <span class="info-val">${tx.created_at ? new Date(tx.created_at).toString() : 'N/A'}</span>
      </div>
    </div>
  `;

  txModal.classList.remove("hidden");
};

closeModalBtn.addEventListener("click", () => txModal.classList.add("hidden"));
txModal.addEventListener("click", (e) => {
  if (e.target === txModal) txModal.classList.add("hidden");
});

// Helper Functions
function truncateText(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
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
txSearchInput.addEventListener("input", () => {
  clearSearchBtn.classList.toggle("hidden", txSearchInput.value.length === 0);
  applyFiltersAndSort();
});

clearSearchBtn.addEventListener("click", () => {
  txSearchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFiltersAndSort();
});

typeFilter.addEventListener("change", applyFiltersAndSort);
networkFilter.addEventListener("change", applyFiltersAndSort);
statusFilter.addEventListener("change", applyFiltersAndSort);
sortBy.addEventListener("change", applyFiltersAndSort);

refreshTxBtn.addEventListener("click", () => {
  refreshTxBtn.querySelector("i").classList.add("fa-spin");
  fetchPurchaseTransactions().finally(() => {
    setTimeout(() => refreshTxBtn.querySelector("i").classList.remove("fa-spin"), 600);
  });
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderPaginatedTable();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredTxDataset.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPaginatedTable();
  }
});

document.addEventListener("DOMContentLoaded", fetchPurchaseTransactions);