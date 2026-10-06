const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let cachedCustomers = [];

const customersTableBody = document.getElementById("customersTableBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const toast = document.getElementById("toastNotification");

// Metric Elements
const metricTotalCustomers = document.getElementById("metricTotalCustomers");
const metricReferredAccounts = document.getElementById("metricReferredAccounts");
const metricTotalPayouts = document.getElementById("metricTotalPayouts");
const metricTotalPayoutValue = document.getElementById("metricTotalPayoutValue");

// Fetch customer records matching database schema
async function fetchReferralData() {
  customersTableBody.innerHTML = `<tr><td colspan="7" class="loading-state">Fetching latest customer data...</td></tr>`;

  const { data: customers, error } = await supabaseClient
    .from("customers")
    .select(`
      user_id,
      surname,
      other_name,
      email,
      phone_number,
      gender,
      balance,
      referred_by,
      referral_paid,
      total_referrals,
      referral_rewarded,
      referral_rewarded_at,
      referral_reward_transaction_id
    `)
    .order("surname", { ascending: true });

  if (error) {
    showToast("Failed to fetch referral records: " + error.message);
    customersTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Error loading database records.</td></tr>`;
    return;
  }

  cachedCustomers = customers || [];
  computeMetrics(cachedCustomers);
  renderTable(cachedCustomers);
}

// Update Top Metrics Cards
function computeMetrics(data) {
  const totalCount = data.length;
  const referredCount = data.filter(c => c.referred_by !== null && c.referred_by !== "").length;
  const paidCount = data.filter(c => c.referral_paid === true || c.referral_rewarded === true).length;
  const totalPayoutVal = paidCount * 100;

  metricTotalCustomers.textContent = totalCount.toLocaleString();
  metricReferredAccounts.textContent = referredCount.toLocaleString();
  metricTotalPayouts.textContent = paidCount.toLocaleString();
  metricTotalPayoutValue.textContent = `₦${totalPayoutVal.toFixed(2)}`;
}

// Render Table Rows
function renderTable(data) {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const filterVal = statusFilter.value;

  const filtered = data.filter(row => {
    const fullName = `${row.surname || ""} ${row.other_name || ""}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm) ||
      (row.email && row.email.toLowerCase().includes(searchTerm)) ||
      (row.phone_number && row.phone_number.includes(searchTerm)) ||
      (row.user_id && row.user_id.toLowerCase().includes(searchTerm));

    let matchesFilter = true;
    if (filterVal === "REFERRED") {
      matchesFilter = row.referred_by !== null && row.referred_by !== "";
    } else if (filterVal === "PAID") {
      matchesFilter = row.referral_paid === true || row.referral_rewarded === true;
    } else if (filterVal === "UNPAID") {
      matchesFilter = row.referred_by && (row.referral_paid === false && row.referral_rewarded === false);
    }

    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    customersTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No matching records found.</td></tr>`;
    return;
  }

  customersTableBody.innerHTML = filtered.map(row => {
    const name = `${row.surname || ""} ${row.other_name || ""}`.trim() || "N/A";
    const balance = parseFloat(row.balance || 0).toFixed(2);
    const isPaid = row.referral_paid || row.referral_rewarded;
    
    let statusBadge = `<span class="badge badge-none">N/A</span>`;
    if (row.referred_by) {
      statusBadge = isPaid 
        ? `<span class="badge badge-success">Paid (₦100)</span>` 
        : `<span class="badge badge-warning">Pending</span>`;
    }

    const rewardDate = row.referral_rewarded_at 
      ? new Date(row.referral_rewarded_at).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" }) 
      : "-";

    return `
      <tr>
        <td>
          <div class="user-cell">
            <span class="user-name">${escapeHtml(name)}</span>
            <span class="user-id-badge">${escapeHtml(row.user_id || "N/A")}</span>
          </div>
        </td>
        <td>
          <div class="contact-cell">
            <div>${escapeHtml(row.email || "")}</div>
            <div>${escapeHtml(row.phone_number || "")}</div>
          </div>
        </td>
        <td><strong>₦${balance}</strong></td>
        <td>${row.referred_by ? `<span class="user-id-badge">${escapeHtml(row.referred_by)}</span>` : '<span style="color: #9ca3af;">Direct</span>'}</td>
        <td><strong>${row.total_referrals || 0}</strong></td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.8rem; color: #6b7280;">${rewardDate}</td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

// Event Listeners
searchInput.addEventListener("input", () => renderTable(cachedCustomers));
statusFilter.addEventListener("change", () => renderTable(cachedCustomers));
refreshDataBtn.addEventListener("click", fetchReferralData);

document.addEventListener("DOMContentLoaded", fetchReferralData);