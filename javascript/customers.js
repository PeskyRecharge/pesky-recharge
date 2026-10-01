// =========================================================
// SUPABASE CLIENT CONFIGURATION
// =========================================================
const SUPABASE_URL = "https://beyykzogvaemjvecbzkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM References
const customerTableBody = document.getElementById("customerTableBody");
const customerSearchInput = document.getElementById("customerSearchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const genderFilter = document.getElementById("genderFilter");
const sortBy = document.getElementById("sortBy");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const recordCountInfo = document.getElementById("recordCountInfo");

// Metric DOM References
const metricTotalCustomers = document.getElementById("metricTotalCustomers");
const metricTotalBalance = document.getElementById("metricTotalBalance");
const metricGenderRatio = document.getElementById("metricGenderRatio");
const metricActiveTransactors = document.getElementById("metricActiveTransactors");

// Pagination Controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const currentPageDisplay = document.getElementById("currentPageDisplay");

// Modal Controls
const customerModal = document.getElementById("customerModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalContent = document.getElementById("modalContent");

// State
let rawCustomersDataset = [];
let filteredCustomersDataset = [];
let currentPage = 1;
const itemsPerPage = 10;

// =========================================================
// DATA FETCH ENGINE
// =========================================================
async function fetchCustomerRecords() {
  renderLoadingState();

  try {
    const { data, error } = await db
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    rawCustomersDataset = data || [];
    computeMetrics(rawCustomersDataset);
    applyFiltersAndSort();
  } catch (err) {
    console.error("[CustomersModule] Data retrieval error:", err);
    renderErrorState(err.message);
  }
}

// =========================================================
// METRICS ENGINE
// =========================================================
function computeMetrics(customers) {
  const total = customers.length;
  let maleCount = 0;
  let femaleCount = 0;
  let aggregateBalance = 0;
  let activeTransactorsCount = 0;

  customers.forEach((c) => {
    const gender = (c.gender || "").toLowerCase();
    if (gender === "male") maleCount++;
    if (gender === "female") femaleCount++;

    const bal = parseFloat(c.balance || 0);
    aggregateBalance += isNaN(bal) ? 0 : bal;

    // Check if transactions JSONB array has items
    if (c.transactions && Array.isArray(c.transactions) && c.transactions.length > 0) {
      activeTransactorsCount++;
    }
  });

  metricTotalCustomers.innerText = total.toLocaleString();
  metricTotalBalance.innerText = `₦${aggregateBalance.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  metricGenderRatio.innerText = `${maleCount} M / ${femaleCount} F`;
  metricActiveTransactors.innerText = activeTransactorsCount.toLocaleString();
}

// =========================================================
// FILTERS & SORT ENGINE
// =========================================================
function applyFiltersAndSort() {
  const query = customerSearchInput.value.toLowerCase().trim();
  const selectedGender = genderFilter.value;
  const selectedSort = sortBy.value;

  filteredCustomersDataset = rawCustomersDataset.filter((item) => {
    const surname = (item.surname || "").toLowerCase();
    const otherName = (item.other_name || "").toLowerCase();
    const fullName = `${surname} ${otherName}`.trim();
    const email = (item.email || "").toLowerCase();
    const phone = (item.phone_number || "").toLowerCase();
    const customUserId = (item.user_id || "").toLowerCase();
    const primaryId = (item.id || "").toLowerCase();
    const authId = (item.auth_id || "").toLowerCase();
    const gender = (item.gender || "").toLowerCase();

    const matchesQuery =
      fullName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      customUserId.includes(query) ||
      primaryId.includes(query) ||
      authId.includes(query);

    let matchesGender = true;
    if (selectedGender !== "all") matchesGender = gender === selectedGender;

    return matchesQuery && matchesGender;
  });

  // Sorting Logic
  filteredCustomersDataset.sort((a, b) => {
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
// TABLE RENDER ENGINE
// =========================================================
function renderPaginatedTable() {
  const totalItems = filteredCustomersDataset.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalItems === 0) {
    customerTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="state-container">
          <div style="color: var(--text-secondary);">
            <i class="fa-solid fa-user-slash" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>No customer records found matching your filter.</p>
          </div>
        </td>
      </tr>`;
    updatePaginationUI(0, 0, 1, 1);
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentSlice = filteredCustomersDataset.slice(startIndex, endIndex);

  customerTableBody.innerHTML = currentSlice
    .map((item) => {
      const surname = item.surname || "";
      const otherName = item.other_name || "";
      const fullName = `${surname} ${otherName}`.trim() || "Unnamed Customer";
      const email = item.email || "No Email";
      const phone = item.phone_number || "N/A";
      const gender = item.gender || "Unspecified";
      const customUserId = item.user_id || "N/A";
      const balance = parseFloat(item.balance || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const initial = surname ? surname.charAt(0).toUpperCase() : "C";
      const joinedDate = item.created_at
        ? new Date(item.created_at).toLocaleDateString("en-US", {
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
        <td>
          <span class="gender-tag">
            <i class="fa-solid ${gender.toLowerCase() === 'male' ? 'fa-mars' : 'fa-venus'}"></i>
            ${sanitizeHTML(gender)}
          </span>
        </td>
        <td class="wallet-balance-cell">₦${balance}</td>
        <td><span class="custom-id-tag">${sanitizeHTML(customUserId)}</span></td>
        <td>${joinedDate}</td>
        <td class="text-right">
          <button class="action-icon-btn" title="Inspect Customer Record" onclick="openCustomerDetailsModal('${item.id}')">
            <i class="fa-solid fa-eye"></i>
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
  customerTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="state-container">
        <div class="loading-spinner">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Retrieving records from 'customers'...</span>
        </div>
      </td>
    </tr>`;
}

function renderErrorState(msg) {
  customerTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="state-container" style="color: var(--accent-red);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; margin-bottom: 12px;"></i>
        <p><strong>Failed to Fetch Customers</strong></p>
        <span style="font-size: 0.8rem; opacity: 0.8;">${sanitizeHTML(msg)}</span>
      </td>
    </tr>`;
}

// =========================================================
// MODAL ENGINE FOR CUSTOMER AUDIT
// =========================================================
window.openCustomerDetailsModal = function (id) {
  const customer = rawCustomersDataset.find((c) => c.id === id);
  if (!customer) return;

  const surname = customer.surname || "";
  const otherName = customer.other_name || "";
  const fullName = `${surname} ${otherName}`.trim() || "Unnamed Customer";
  const formattedBalance = parseFloat(customer.balance || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const txJson = customer.transactions
    ? JSON.stringify(customer.transactions, null, 2)
    : "[] (No JSONB transaction records found)";

  modalContent.innerHTML = `
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Full Name</span>
        <span class="info-val">${sanitizeHTML(fullName)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email Address</span>
        <span class="info-val">${sanitizeHTML(customer.email || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone Number</span>
        <span class="info-val">${sanitizeHTML(customer.phone_number || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Current Balance</span>
        <span class="info-val text-green">₦${formattedBalance}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Custom User ID</span>
        <span class="info-val">${sanitizeHTML(customer.user_id || 'N/A')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Auth UUID</span>
        <span class="info-val">${sanitizeHTML(customer.auth_id || 'N/A')}</span>
      </div>
    </div>

    <div>
      <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">
        <i class="fa-solid fa-code"></i> Raw JSONB Transactions Log
      </h4>
      <div class="json-box">${sanitizeHTML(txJson)}</div>
    </div>
  `;

  customerModal.classList.remove("hidden");
};

closeModalBtn.addEventListener("click", () => customerModal.classList.add("hidden"));
customerModal.addEventListener("click", (e) => {
  if (e.target === customerModal) customerModal.classList.add("hidden");
});

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
customerSearchInput.addEventListener("input", () => {
  clearSearchBtn.classList.toggle("hidden", customerSearchInput.value.length === 0);
  applyFiltersAndSort();
});

clearSearchBtn.addEventListener("click", () => {
  customerSearchInput.value = "";
  clearSearchBtn.classList.add("hidden");
  applyFiltersAndSort();
});

genderFilter.addEventListener("change", applyFiltersAndSort);
sortBy.addEventListener("change", applyFiltersAndSort);

refreshDataBtn.addEventListener("click", () => {
  refreshDataBtn.querySelector("i").classList.add("fa-spin");
  fetchCustomerRecords().finally(() => {
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
  const totalPages = Math.ceil(filteredCustomersDataset.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPaginatedTable();
  }
});

document.addEventListener("DOMContentLoaded", fetchCustomerRecords);