// Supabase project settings
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM references
const historyContainer = document.getElementById("historyContainer");
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

// Load all purchases for the logged-in customer
async function loadPurchaseReports() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    historyContainer.textContent = "Redirecting to login...";
    window.location.href = "login.html";
    return;
  }

  document.getElementById("userName").textContent = userData.user.email || "Customer";

  const { data, error } = await supabaseClient
    .from("pin_purchases")
    .select("network, denomination, quantity, total_cost, pins, created_at")
    .eq("auth_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading reports:", error);
    historyContainer.textContent = "Unable to load your purchase reports.";
    return;
  }
  if (!data || data.length === 0) {
    historyContainer.textContent = "No purchases found.";
    return;
  }

  renderReports(data);
}

// Render each purchase as its own report-container
function renderReports(purchases) {
  historyContainer.innerHTML = "";

  purchases.forEach((purchase) => {
    let pinsArray = purchase.pins;
    if (typeof pinsArray === "string") {
      try { pinsArray = JSON.parse(pinsArray); } catch { pinsArray = []; }
    }

    const report = document.createElement("div");
    report.className = "report-container";

    // Optional heading per purchase
    const heading = document.createElement("h1");
    heading.textContent = `Purchase Report - ${new Date(purchase.created_at).toLocaleDateString()}`;
    report.appendChild(heading);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "cards-container";

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

    report.appendChild(cardsContainer);
    historyContainer.appendChild(report);
  });
}

// Initialize
loadPurchaseReports();
