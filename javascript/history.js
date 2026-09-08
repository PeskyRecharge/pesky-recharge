// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM references
const historyContainer = document.getElementById("historyContainer");
document.getElementById("reportDate").textContent = new Date().toLocaleString();
document.getElementById("downloadBtn").addEventListener("click", () => window.print());

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

// Load purchases by email
async function loadPurchaseReportsByEmail(email, button) {
  historyContainer.textContent = "Loading purchases...";
  button.classList.add("loading");

  const { data, error } = await supabaseClient
    .from("pin_purchases")
    .select("network, denomination, quantity, total_cost, pins, created_at")
    .eq("user_email", email) // adjust column name if different
    .order("created_at", { ascending: false });

  button.classList.remove("loading");

  if (error) {
    console.error("Error loading reports:", error);
    historyContainer.textContent = "Unable to load purchase reports.";
    return;
  }
  if (!data || data.length === 0) {
    historyContainer.textContent = "No purchases found for this email.";
    return;
  }

  // Hide the email form once we have results
  document.getElementById("emailForm").style.display = "none";

  renderReports(data, email);
}

// Render reports
function renderReports(purchases, email) {
  historyContainer.innerHTML = "";
  const userHeading = document.createElement("h2");
  userHeading.textContent = `Showing purchases for: ${email}`;
  historyContainer.appendChild(userHeading);

  purchases.forEach((purchase) => {
    let pinsArray = purchase.pins;
    if (typeof pinsArray === "string") {
      try { pinsArray = JSON.parse(pinsArray); } catch { pinsArray = []; }
    }

    const report = document.createElement("div");
    report.className = "report-container";

    const heading = document.createElement("h3");
    heading.textContent = `Purchase Report - ${new Date(purchase.created_at).toLocaleDateString()}`;
    report.appendChild(heading);

    const summary = document.createElement("p");
    summary.textContent = `Quantity: ${purchase.quantity || 0}, Total Cost: ₦${purchase.total_cost || 0}`;
    report.appendChild(summary);

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
          <p class="card-detail">Dial *311*PIN# — ${new Date(purchase.created_at).toLocaleTimeString()}</p>
          <p class="card-detail">Date: ${