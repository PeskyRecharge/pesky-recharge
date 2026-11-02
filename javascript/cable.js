const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Admin Profit Markup (e.g. Add ₦100 or 1.5% profit margin per package)
const ADMIN_GAIN_FLAT = 100; 

let currentUserId = null;
let selectedService = null;
let selectedBouquet = null;
let verifiedCustomerData = null;

const verificationSection = document.getElementById("verificationSection");
const verifyCardForm = document.getElementById("verifyCardForm");
const smartcardNumberInput = document.getElementById("smartcardNumberInput");
const verifyBtn = document.getElementById("verifyBtn");
const verifiedCustomerBox = document.getElementById("verifiedCustomerBox");
const custName = document.getElementById("custName");

const bouquetsSection = document.getElementById("bouquetsSection");
const bouquetsGrid = document.getElementById("bouquetsGrid");
const subscribeBtn = document.getElementById("subscribeBtn");

const receiptModal = document.getElementById("receiptModal");

async function initUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = "/login.html"; return; }
  const { data: profile } = await supabaseClient
    .from("customers")
    .select("user_id, balance")
    .eq("email", user.email)
    .maybeSingle();

  if (profile) currentUserId = profile.user_id;
}

// 1. Provider Selection
document.querySelectorAll(".provider-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".provider-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedService = btn.dataset.service;
    
    verificationSection.hidden = false;
    bouquetsSection.hidden = false;
    verifiedCustomerBox.hidden = true;
    verifiedCustomerData = null;
    subscribeBtn.disabled = true;

    fetchBouquets(selectedService);
  });
});

// 2. Fetch Bouquets from Edge Function
async function fetchBouquets(serviceId) {
  bouquetsGrid.innerHTML = `<p class="loading-text">Fetching packages for ${serviceId.toUpperCase()}...</p>`;

  const { data, error } = await supabaseClient.functions.invoke("cable", {
    body: { action: "get_bouquets", service_id: serviceId }
  });

  if (error || !data || data.code !== "success") {
    bouquetsGrid.innerHTML = `<p class="loading-text" style="color: red;">Error loading packages.</p>`;
    return;
  }

  renderBouquets(data.data);
}

// 3. Render Bouquets with Admin Gain Included
function renderBouquets(bouquets) {
  bouquetsGrid.innerHTML = bouquets.map(b => {
    const costPrice = parseFloat(b.price);
    const userPrice = costPrice + ADMIN_GAIN_FLAT; // Adding gain

    return `
      <div class="bouquet-card" data-variation="${b.variation_id}" data-cost="${costPrice}" data-userprice="${userPrice}" data-name="${b.name}">
        <span class="bouquet-name">${b.name}</span>
        <span class="bouquet-price">₦${userPrice.toLocaleString()}</span>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".bouquet-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".bouquet-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      selectedBouquet = {
        variation_id: card.dataset.variation,
        name: card.dataset.name,
        cost_price: parseFloat(card.dataset.cost),
        user_price: parseFloat(card.dataset.userprice)
      };

      if (verifiedCustomerData) subscribeBtn.disabled = false;
    });
  });
}

// 4. Verify Smartcard / IUC
verifyCardForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const customer_id = smartcardNumberInput.value.trim();

  if (!selectedService || !customer_id) {
    showToast("Please select a provider and enter Smartcard number.");
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying...";

  const { data, error } = await supabaseClient.functions.invoke("cable", {
    body: {
      action: "verify",
      payload: { customer_id, service_id: selectedService }
    }
  });

  verifyBtn.disabled = false;
  verifyBtn.textContent = "Verify Customer";

  if (error || !data || data.code !== "success") {
    showToast(data?.message || "Customer verification failed.");
    return;
  }

  verifiedCustomerData = {
    customer_id,
    customer_name: data.data.customer_name || "N/A"
  };

  custName.textContent = verifiedCustomerData.customer_name;
  verifiedCustomerBox.hidden = false;
  
  if (selectedBouquet) subscribeBtn.disabled = false;
  showToast("Customer verified successfully!");
});

// 5. Purchase Subscription
subscribeBtn.addEventListener("click", async () => {
  if (!selectedService || !selectedBouquet || !verifiedCustomerData) return;

  const { data: customer } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (!customer || parseFloat(customer.balance) < selectedBouquet.user_price) {
    showToast("Insufficient wallet balance.");
    return;
  }

  subscribeBtn.disabled = true;
  subscribeBtn.textContent = "Processing Subscription...";

  const requestId = `cable_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const { data, error } = await supabaseClient.functions.invoke("cable", {
    body: {
      action: "purchase",
      payload: {
        request_id: requestId,
        customer_id: verifiedCustomerData.customer_id,
        service_id: selectedService,
        variation_id: selectedBouquet.variation_id
      }
    }
  });

  if (error || !data || data.code !== "success") {
    showToast(data?.message || "Subscription failed.");
    subscribeBtn.disabled = false;
    subscribeBtn.textContent = "Subscribe Now";
    return;
  }

  const result = data.data;

  // Deduct user wallet balance
  const newBalance = parseFloat(customer.balance) - selectedBouquet.user_price;
  await supabaseClient.from("customers").update({ balance: newBalance }).eq("user_id", currentUserId);

  // Log transaction
  await supabaseClient.from("cable_transactions").insert([{
    request_id: requestId,
    user_id: currentUserId,
    service_id: selectedService,
    variation_id: selectedBouquet.variation_id,
    bouquet_name: selectedBouquet.name,
    customer_id: verifiedCustomerData.customer_id,
    customer_name: result.customer_name || verifiedCustomerData.customer_name,
    amount_paid: selectedBouquet.user_price,
    cost_price: selectedBouquet.cost_price,
    admin_margin: selectedBouquet.user_price - selectedBouquet.cost_price,
    status: "completed",
    api_response: data
  }]);

  // Show Receipt Modal
  document.getElementById("receiptService").textContent = selectedService.toUpperCase();
  document.getElementById("receiptBouquet").textContent = selectedBouquet.name;
  document.getElementById("receiptCustomer").textContent = result.customer_name || verifiedCustomerData.customer_name;
  document.getElementById("receiptIUC").textContent = verifiedCustomerData.customer_id;
  document.getElementById("receiptAmount").textContent = selectedBouquet.user_price.toFixed(2);
  document.getElementById("receiptOrderId").textContent = result.order_id || "N/A";

  receiptModal.hidden = false;
});

document.getElementById("closeReceiptBtn").addEventListener("click", () => {
  window.location.reload();
});

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

document.addEventListener("DOMContentLoaded", initUser);