const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

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
    createTextElement("p", "card-detail", `Dial *311*PIN#     ${new Date(purchase.created_at).toLocaleTimeString()}.`),
    createTextElement("p", "card-detail", `Date: ${new Date(purchase.created_at).toLocaleDateString()}`),
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

  const cards = pins.length ? pins.map((pin) => `
    <article class="card">
      <strong>${escapeHtml(String(purchase.network || "N/A").toUpperCase())}</strong>
      <b>${escapeHtml(formatCurrency(purchase.denomination))}</b>
      <p>Serial number: ${escapeHtml(pin.serial || "N/A")}</p>
      <p class="pin">PIN: ${escapeHtml(formatPin(pin.pin))}</p>
      <p>Dial *311*PIN# | ${escapeHtml(new Date(purchase.created_at).toLocaleTimeString())}.</p>
      <p>Date: ${escapeHtml(new Date(purchase.created_at).toLocaleDateString())}</p>
    </article>
  `).join("") : `<article class="card">
    <strong>${escapeHtml(String(purchase.network || "RECHARGE").toUpperCase())}</strong>
    <b>${escapeHtml(formatCurrency(purchase.total_cost || purchase.denomination))}</b>
    <p>Purchase recorded from the customer transaction history.</p>
    <p>Date: ${escapeHtml(formatDate(purchase.created_at))}</p>
  </article>`;

  printWindow.document.write(`<!doctype html><html><head><title>Pesky Recharge - ${escapeHtml(formatDate(purchase.created_at))}</title><style>
    @page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#10243e;margin:0}h1{font-size:13px;color:#0078d7;text-align:center;margin:0 0 2px}p{margin:1px 0;font-size:9px;color:#333}.meta{margin-bottom:6px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.card{border:1px solid #777;border-radius:3px;padding:4px 6px;break-inside:avoid;font-size:9px;line-height:1}.card strong,.card b{display:block;margin-bottom:2px}.card b{color:#0078d7;font-size:12px}.pin{color:#d32f2f;font-weight:700;background:#e0e0e0;padding:3px 2px;border-radius:3px;letter-spacing:.5px}
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
  purchases.forEach((purchase, index) => {
    const pins = parsePins(purchase.pins);
    const report = document.createElement("div");
    report.className = "report-container purchase-batch-report";
    report.append(
      createTextElement("h1", "", "PESKY RECHARGE - Purchase Report"),
      createTextElement("p", "", `User: ${email}`),
      createTextElement("p", "", `Date: ${formatDate(purchase.created_at)}`),
    );

    const cards = document.createElement("div");
    cards.className = "cards-container";
    if (pins.length) {
      pins.forEach((pin) => cards.appendChild(createPinCard(purchase, pin)));
    } else {
      const card = document.createElement("article");
      card.className = "recharge-card legacy-purchase-card";
      const header = document.createElement("div");
      header.className = "card-header";
      header.appendChild(createTextElement("span", "reference", "Ref: Pesky-Recharge"));
      const branding = document.createElement("div");
      branding.className = "card-branding";
      branding.appendChild(createTextElement("span", "amount", formatCurrency(purchase.total_cost || purchase.denomination)));
      header.appendChild(branding);
      card.append(
        header,
        createTextElement("p", "card-detail", `${String(purchase.network || "Recharge").toUpperCase()} purchase`),
        createTextElement("p", "card-detail", `Quantity: ${purchase.quantity || 1}`),
        createTextElement("p", "card-detail", `Date: ${formatDate(purchase.created_at)}`),
      );
      cards.appendChild(card);
    }
    report.appendChild(cards);

    const buttons = document.createElement("div");
    buttons.className = "buttons report-actions";
    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "print-btn print-secondary";
    printButton.textContent = `Print / Save PDF - Batch ${index + 1}`;
    printButton.addEventListener("click", () => printBatch(purchase, pins, email));
    buttons.appendChild(printButton);
    historyContainer.append(report, buttons);
  });
}

async function loadPurchaseHistory(event) {
  event?.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return;

  viewButton.disabled = true;
  viewButton.classList.add("loading");
  historyContainer.replaceChildren(createTextElement("p", "status", "Loading purchase history..."));

  const { data: customers, error: customerError } = await supabaseClient
    .from("customers")
    .select("auth_id, transactions")
    .ilike("email", email)
    .limit(20);

  if (customerError) {
    console.error("Customer lookup error:", customerError);
    viewButton.disabled = false;
    viewButton.classList.remove("loading");
    historyContainer.replaceChildren(createTextElement("p", "status error", "Unable to find this customer. Check your admin access and database policy."));
    return;
  }

  const authIds = [...new Set((customers || []).map((customer) => customer.auth_id).filter(Boolean))];
  if (!authIds.length) {
    viewButton.disabled = false;
    viewButton.classList.remove("loading");
    historyContainer.replaceChildren(createTextElement("p", "status", "No customer was found for this email."));
    return;
  }

  const { data: pinPurchases, error } = await supabaseClient
    .from("pin_purchases")
    .select("auth_id, network, denomination, quantity, total_cost, pins, created_at")
    .order("created_at", { ascending: false });

  viewButton.disabled = false;
  viewButton.classList.remove("loading");

  if (error) {
    console.error("Purchase history error:", error);
    historyContainer.replaceChildren(createTextElement("p", "status error", "Unable to load history. Check your admin access and database policy."));
    return;
  }

  const customerPinPurchases = (pinPurchases || []).filter((purchase) =>
    authIds.includes(purchase.auth_id)
  );

  const transactionPurchases = customers.flatMap((customer) => {
    let transactions = customer.transactions || [];
    if (typeof transactions === "string") {
      try { transactions = JSON.parse(transactions); } catch { transactions = []; }
    }
    if (!Array.isArray(transactions)) return [];

    return transactions
      .filter((transaction) => transaction.type === "deduct")
      .map((transaction) => ({
        network: transaction.network || "Recharge",
        denomination: transaction.denomination || transaction.amount,
        quantity: transaction.quantity || 1,
        total_cost: transaction.amount,
        pins: [],
        created_at: transaction.date,
      }));
  });

  const purchases = [
    ...customerPinPurchases,
    ...transactionPurchases.filter((transaction) => !customerPinPurchases.some((purchase) => {
      const sameAmount = Number(purchase.total_cost) === Number(transaction.total_cost);
      const timeDifference = Math.abs(
        new Date(purchase.created_at).getTime() - new Date(transaction.created_at).getTime()
      );
      return sameAmount && timeDifference <= 10000;
    })),
  ].sort((first, second) => new Date(second.created_at) - new Date(first.created_at));
  if (!purchases.length) {
    historyContainer.replaceChildren(createTextElement("p", "status", "No purchase batches found for this email."));
    return;
  }

  renderBatches(purchases, email);
}

emailForm.addEventListener("submit", loadPurchaseHistory);