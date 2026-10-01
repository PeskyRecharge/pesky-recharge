// =========================================================
// 1. SUPABASE INITIALIZATION
// =========================================================
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let rawPurchases = [];

// DOM Elements
const searchInput = document.getElementById("searchInput");
const networkFilter = document.getElementById("networkFilter");
const purchasesTableBody = document.getElementById("purchasesTableBody");
const pinModal = document.getElementById("pinModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");

// =========================================================
// 2. FETCH TRANSACTIONS FROM SUPABASE
// =========================================================
async function fetchPurchases() {
  try {
    const { data, error } = await supabaseClient
      .from("pin_purchases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    rawPurchases = data || [];
    updateMetrics(rawPurchases);
    renderTable(rawPurchases);
  } catch (err) {
    console.error("Error loading purchases:", err.message);
    if (purchasesTableBody) {
      purchasesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
            <p style="margin-top: 8px;">Failed to load purchase records.</p>
          </td>
        </tr>`;
    }
  }
}

// =========================================================
// 3. METRICS & TABLE RENDER
// =========================================================
function updateMetrics(data) {
  const totalRev = data.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
  const totalPins = data.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const revenueEl = document.getElementById("totalRevenue");
  const ordersEl = document.getElementById("totalOrders");
  const pinsEl = document.getElementById("totalPins");

  if (revenueEl) revenueEl.innerText = `₦${totalRev.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (ordersEl) ordersEl.innerText = data.length;
  if (pinsEl) pinsEl.innerText = totalPins;
}

function renderTable(data) {
  if (!purchasesTableBody) return;

  if (data.length === 0) {
    purchasesTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">
          <i class="fa-solid fa-folder-open fa-2x"></i>
          <p style="margin-top: 8px;">No purchase records found.</p>
        </td>
      </tr>`;
    return;
  }

  purchasesTableBody.innerHTML = data.map((item, index) => {
    const net = (item.network || '').toUpperCase();
    let netClass = 'net-mtn';
    if (net.includes('GLO')) netClass = 'net-glo';
    else if (net.includes('AIR')) netClass = 'net-airtel';
    else if (net.includes('9')) netClass = 'net-9mobile';

    const formattedDate = item.created_at 
      ? new Date(item.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A';

    return `
      <tr>
        <td>${formattedDate}</td>
        <td><span class="badge-network ${netClass}">${net}</span></td>
        <td><strong>₦${item.denomination || 0}</strong></td>
        <td>${item.quantity || 0}</td>
        <td style="color: #10b981; font-weight: 700;">₦${Number(item.total_cost || 0).toFixed(2)}</td>
        <td><span class="uuid-text" title="${item.auth_id || ''}">${item.auth_id ? item.auth_id.substring(0, 8) + '...' : 'N/A'}</span></td>
        <td>
          <button class="btn-view" data-index="${index}">
            <i class="fa-solid fa-eye"></i> View PINs (${Array.isArray(item.pins) ? item.pins.length : 0})
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach click listeners to view buttons
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-index');
      openPinModal(data[idx].pins);
    });
  });
}

// =========================================================
// 4. SEARCH & FILTERING
// =========================================================
function filterData() {
  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const selectedNetwork = networkFilter ? networkFilter.value : "ALL";

  const filtered = rawPurchases.filter(item => {
    const matchesNetwork = selectedNetwork === "ALL" || (item.network || '').toUpperCase() === selectedNetwork;
    
    const matchesSearch = 
      (item.auth_id && item.auth_id.toLowerCase().includes(searchValue)) ||
      (item.id && item.id.toLowerCase().includes(searchValue)) ||
      (item.batch_id && item.batch_id.toLowerCase().includes(searchValue));

    return matchesNetwork && matchesSearch;
  });

  renderTable(filtered);
}

if (searchInput) searchInput.addEventListener("input", filterData);
if (networkFilter) networkFilter.addEventListener("change", filterData);

// =========================================================
// 5. PIN MODAL DISPLAY
// =========================================================
function openPinModal(pinsArray) {
  const modalBody = document.getElementById("modalBody");
  if (!modalBody) return;
  
  if (!pinsArray || pinsArray.length === 0) {
    modalBody.innerHTML = `<p style="color: #94a3b8;">No PIN data found in record.</p>`;
  } else {
    modalBody.innerHTML = pinsArray.map((pinObj, idx) => `
      <div class="pin-card" style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span style="font-size: 0.75rem; color: #94a3b8;">Item #${idx + 1}</span>
          <span style="font-size: 0.75rem; color: #94a3b8;">Serial: ${pinObj.serial || 'N/A'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8;">PIN Code:</div>
            <div style="font-family: monospace; font-size: 1rem; font-weight: 700; color: #10b981;">${pinObj.pin || 'N/A'}</div>
          </div>
          <button class="btn-view" style="padding: 4px 8px;" onclick="navigator.clipboard.writeText('${pinObj.pin}')">
            <i class="fa-solid fa-copy"></i> Copy
          </button>
        </div>
      </div>
    `).join('');
  }

  if (pinModal) pinModal.style.display = "flex";
}

function closeModal() {
  if (pinModal) pinModal.style.display = "none";
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
window.addEventListener("click", (event) => {
  if (event.target === pinModal) closeModal();
});

// =========================================================
// 6. SUPABASE REALTIME SUBSCRIPTION
// =========================================================
function setupRealtime() {
  supabaseClient
    .channel('admin-pin-purchases')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pin_purchases' },
      (payload) => {
        rawPurchases.unshift(payload.new);
        updateMetrics(rawPurchases);
        filterData();
      }
    )
    .subscribe();
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  fetchPurchases();
  setupRealtime();
});