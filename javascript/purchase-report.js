// Supabase project settings
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM references
const cardsContainer = document.getElementById("cardsContainer");
document.getElementById("reportDate").textContent = new Date().toLocaleString();
document.getElementById("downloadBtn").addEventListener("click", () => {
  window.print();
});

// Logo mapping
const logos = {
  "MTN": "mtn1.png",
  "GLO": "glo2.png",
  "AIRTEL": "airtel3.png",
  "9MOBILE": "9mobile4.png"
};

function formatPin(pin) {
  const digits = String(pin || "").replace(/\D/g, "");
  return digits ? digits.replace(/(.{4})/g, "$1-").replace(/-$/, "") : "N/A";
}

// Load the latest purchase for the logged-in customer.
async function loadLatestPurchase() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    cardsContainer.textContent = "Redirecting to login...";
    window.location.href = "login.html";
    return;
  }

  document.getElementById("userName").textContent = userData.user.email || "Customer";

  const { data, error } = await supabaseClient
    .from("pin_purchases")
    .select("network, denomination, quantity, total_cost, pins, created_at")
    .eq("auth_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error loading purchase:", error);
    cardsContainer.textContent = "Unable to load your purchase report.";
    return;
  }
  if (!data || data.length === 0) {
    cardsContainer.textContent = "No purchases found.";
    return;
  }

  renderPurchases(data);
}

// Render card(s) using your actual table columns
function renderPurchases(purchases) {
  cardsContainer.innerHTML = "";

  purchases.forEach((purchase) => {
    let pinsArray = purchase.pins;
    if (typeof pinsArray === "string") {
      try { pinsArray = JSON.parse(pinsArray); } catch { pinsArray = []; }
    }

    if (Array.isArray(pinsArray) && pinsArray.length > 0) {
      pinsArray.forEach((pinObj) => {
        const network = String(purchase.network || "").toUpperCase();
        const card = document.createElement("div");
        card.className = "recharge-card";
        card.innerHTML = `
          <div class="card-header">
            <span class="reference">Ref: Pesky-Recharge</span>
            <div class="card-branding">
              <span class="amount">₦${purchase.denomination || "0"}</span>
              <img src="img/${logos[network] || ""}" class="network-logo" alt="${network} logo">
            </div>
          </div>
          <p class="card-detail">S/N: ${pinObj.serial || "N/A"}</p>
          <p class="card-detail pin">PIN: ${formatPin(pinObj.pin)}</p>
          <p class="card-detail">Dial *311*PIN#&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${new Date(purchase.created_at).toLocaleTimeString()}.</p>
          <p class="card-detail">Date: ${new Date(purchase.created_at).toLocaleDateString()}</p>
        `;
        cardsContainer.appendChild(card);
      });
    } else {
      cardsContainer.textContent = "This purchase has no PIN details.";
    }
  });
}

// Subscribe to realtime inserts
supabaseClient
  .channel('realtime-purchases')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'pin_purchases' },
    () => {
      loadLatestPurchase(); // refresh immediately
    }
  )
  .subscribe();

// Initialize
loadLatestPurchase();
