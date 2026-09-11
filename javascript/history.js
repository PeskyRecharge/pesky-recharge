const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("emailInput");
const viewButton = document.getElementById("viewPurchasesBtn");
const historyContainer = document.getElementById("historyContainer");
document.getElementById("reportDate").textContent = new Date().toLocaleString();

const logos = {
  MTN: "mtn1.png",
  GLO: "glo2.png",
  AIRTEL: "airtel3.png",
  "9MOBILE": "9mobile4.png",
};

function formatCurrency(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPin(pin) {
  const digits = String(pin || "").replace(/\D/g, "");
  return digits ? digits.replace(/(.{4})/g, "$1-").replace(/-$/, "") : "N/A";
}

function parsePins(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createPinCard(purchase, pin) {
  const network = String(purchase.network || "N/A").toUpperCase();
  const card = document.createElement("article");
  card.className = "recharge-card";
  const header = document.createElement("div");
  header.className = "card-header";
  header.appendChild(createTextElement("span", "reference", "Ref: Pesky-Recharge"));

  const branding = document.createElement("div");
  branding.className = "card-branding";
  branding.appendChild(createTextElement("span", "amount", formatCurrency(purchase.denomination)));

  if (logos[network]) {
    const logo = document.createElement("img");
    logo.className = "network-logo";
    logo.src = `img/${logos[network]}`;
    logo.alt = `${network} logo`;
    branding.appendChild(logo);
  }

  header.appendChild(branding);
  card.append(
    header,
    createTextElement("p", "card-detail", `S/N: ${pin.serial || "N/A"}`),
    createTextElement("p", "pin", `PIN: ${formatPin(pin.pin)}`),
    createTextElement("p", "card-detail", `Dial *311*PIN# | ${formatDate(purchase.created_at)}`),
  );
  return card;
}

function printBatch(purchase, pins, email) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    historyContainer.querySelector(".status")?.replaceChildren(
      document.createTextNode("Allow pop-ups to download a PDF.")
    );
    return;
  }

  const cards = pins.map((pin) => `
    <article class="card">
      <strong>${escapeHtml(String(purchase.network || "N/A").toUpperCase())}</strong>
      <b>${escapeHtml(formatCurrency(purchase.denomination))}</b>
      <p>Serial number: ${escapeHtml(pin.serial || "N/A")}</p>
      <p class="pin">PIN: ${escapeHtml(formatPin(pin.pin))}</p>
      <p>Dial *311*PIN#</p>
    </article>
  `).join("");

  printWindow.document.write(`<!doctype html><html><head><title>Pesky Recharge - ${escapeHtml(formatDate(purchase.created_at))}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#10243e;margin:32px}h1{font-size:24px;margin:0 0 6px}p{margin:6px 0;color:#5e6b7d}.meta{border-bottom:1px solid #d9e1e8;padding-bottom:18px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #ccd7e1;border-radius:8px;padding:14px;break-inside:avoid}.card strong,.card b{display:block;margin-bottom:8px}.card b{color:#087b75;font-size:18px}.pin{color:#b42318;font-weight:700;background:#fff1ef;padding:8px;border-radius:5px}@media print{body{margin:12mm}.grid{grid-template-columns:repeat(3,1fr)}}
  </style></head><body><h1>PESKY RECHARGE</h1><div class="meta"><p>Purchase batch</p><p>Email: ${escapeHtml(email)}</p><p>Date: ${escapeHtml(formatDate(purchase.created_at))}</p><p>Quantity: ${escapeHtml(String(purchase.quantity || pins.length))} | Total: ${escapeHtml(formatCurrency(purchase.total_cost))}</p></div><div class="grid">${cards}</div><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  printWindow.document.close();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function renderBatches(purchases, email) {
  historyContainer.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "results-heading";
  heading.append(
    createTextElement("h2", "", "Purchase batches"),
    createTextElement("p", "muted", `${purchases.length} batch${purchases.length === 1 ? "" : "es"} found for ${email}`),
  );
  historyContainer.appendChild(heading);

  purchases.forEach((purchase, index) => {
    const pins = parsePins(purchase.pins);
    const batch = document.createElement("section");
    batch.className = "batch";
    const batchHeader = document.createElement("div");
    batchHeader.className = "batch-header";
    const title = document.createElement("div");
    title.append(
      createTextElement("h3", "", `Batch ${purchases.length - index}`),
      createTextElement("p", "muted", formatDate(purchase.created_at)),
    );
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "pdf-button";
    printButton.textContent = "Download PDF";
    printButton.addEventListener("click", () => printBatch(purchase, pins, email));
    batchHeader.append(title, printButton);
    batch.appendChild(batchHeader);

    const summary = document.createElement("div");
    summary.className = "batch-summary";
    summary.append(
      createTextElement("span", "summary-item", `Network: ${String(purchase.network || "N/A").toUpperCase()}`),
      createTextElement("span", "summary-item", `Denomination: ${formatCurrency(purchase.denomination)}`),
      createTextElement("span", "summary-item", `Quantity: ${purchase.quantity || pins.length}`),
      createTextElement("span", "summary-item", `Total: ${formatCurrency(purchase.total_cost)}`),
    );
    batch.appendChild(summary);

    const cards = document.createElement("div");
    cards.className = "cards-container";
    if (pins.length) {
      pins.forEach((pin) => cards.appendChild(createPinCard(purchase, pin)));
    } else {
      cards.appendChild(createTextElement("p", "empty-batch", "This batch has no PIN details."));
    }
    batch.appendChild(cards);
    historyContainer.appendChild(batch);
  });
}

async function loadPurchaseHistory(event) {
  event?.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return;

  viewButton.disabled = true;
  viewButton.classList.add("loading");
  historyContainer.replaceChildren(createTextElement("p", "status", "Loading purchase history..."));

  const { data: customer, error: customerError } = await supabaseClient
    .from("customers")
    .select("auth_id")
    .ilike("email", email)
    .maybeSingle();

  if (customerError || !customer) {
    viewButton.disabled = false;
    viewButton.classList.remove("loading");
    historyContainer.replaceChildren(createTextElement("p", "status", "No customer was found for this email."));
    return;
  }

  const { data, error } = await supabaseClient
    .from("pin_purchases")
    .select("network, denomination, quantity, total_cost, pins, created_at")
    .eq("auth_id", customer.auth_id)
    .order("created_at", { ascending: false });

  viewButton.disabled = false;
  viewButton.classList.remove("loading");

  if (error) {
    console.error("Purchase history error:", error);
    historyContainer.replaceChildren(createTextElement("p", "status error", "Unable to load history. Check your admin access and database policy."));
    return;
  }

  if (!data?.length) {
    historyContainer.replaceChildren(createTextElement("p", "status", "No purchase batches found for this email."));
    return;
  }

  renderBatches(data, email);
}

emailForm.addEventListener("submit", loadPurchaseHistory);