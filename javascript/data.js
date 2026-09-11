const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById("dataForm");
const phoneInput = document.getElementById("phone");
const phoneHint = document.getElementById("phoneHint");
const detectedNetwork = document.getElementById("detectedNetwork");
const balanceEl = document.getElementById("balance");
const bundleGrid = document.getElementById("bundleGrid");
const gloPlanTable = document.getElementById("gloPlanTable");
const gloPlansStatus = document.getElementById("gloPlansStatus");
const messageEl = document.getElementById("message");
const buyButton = document.getElementById("buyDataBtn");
const successPanel = document.getElementById("successPanel");
const successDetails = document.getElementById("successDetails");
const successOkButton = document.getElementById("successOkButton");

// Replace these IDs and prices with the exact plans from your data provider.
const dataBundles = Object.freeze([
  { id: "100MB", label: "100 MB" },
  { id: "200MB", label: "200 MB" },
  { id: "500MB", label: "500 MB" },
  { id: "1GB", label: "1 GB" },
  { id: "2GB", label: "2 GB" },
  { id: "3GB", label: "3 GB" },
  { id: "5GB", label: "5 GB" },
  { id: "7GB", label: "7 GB" },
  { id: "10GB", label: "10 GB" },
  { id: "20GB", label: "20 GB" },
  { id: "30GB", label: "30 GB" },
]);

const prefixNetworks = {
  MTN: ["0803", "0806", "0810", "0813", "0814", "0816", "0703", "0706", "0903", "0906", "0913", "0916"],
  GLO: ["0805", "0807", "0811", "0815", "0705", "0905", "0915"],
  AIRTEL: ["0802", "0808", "0812", "0701", "0708", "0901", "0902", "0904", "0907", "0912"],
  "9MOBILE": ["0809", "0817", "0818", "0908", "0909"],
};

let currentBalance = 0;
let gloPlans = [];
let activeBundleTab = "standard";
let activeGloCategory = "small";

const gloCatalog = Object.freeze([
  { category: "small", name: "45MB + 5MB Night", validity: "1 Day", notes: "Gifting option", providerName: "Glo 45 MB incl. 5MB Night Data 1 Day (GIFTING)" },
  { category: "small", name: "125MB + 5MB Night", validity: "1 Day", notes: "Gifting option", providerName: "Glo 125 MB incl. 5MB Night 1 Day (GIFTING)" },
  { category: "small", name: "135MB Social Pack", validity: "3 Days", notes: "WhatsApp, Instagram, TikTok, etc.", providerName: "Glo 135MB WhatsApp, Twitter (X), Facebook, TikTok, Snapchat, Telegram, Instagram, Threads and GloTV 3 Days (GIFTING)" },
  { category: "small", name: "275MB + 25MB Night", validity: "2 Days", notes: "Gifting option", providerName: "Glo 275 MB incl. 25MB Night 2 Days (GIFTING)" },
  { category: "small", name: "350MB", validity: "1 Day", notes: "Gifting option", providerName: "Glo 350MB 1 Day (GIFTING)" },
  { category: "medium", name: "750MB", validity: "1 Day", notes: "SME or gifting", providerName: "Glo 750MB 1 Day (GIFTING) night bundle" },
  { category: "medium", name: "1GB", validity: "1-30 Days", notes: "Corporate or gifting", providerName: "Glo 1 GB 1 day (GIFTING)" },
  { category: "medium", name: "1.5GB", validity: "1 Day", notes: "SME or gifting", providerName: "Glo 1.5 GB 1 Day (GIFTING)" },
  { category: "medium", name: "2GB", validity: "30 Days", notes: "Corporate or gifting", providerName: "Glo 2 GB for GLO TV 7 Days (GIFTING)" },
  { category: "medium", name: "2.5GB", validity: "2 Days", notes: "Weekend/Awoof option", providerName: "Glo 2.5 GB 2 Days (GIFTING) weekend plan" },
  { category: "large", name: "3GB", validity: "1-30 Days", notes: "Corporate or gifting", providerName: "Glo 3 GB 1 day (GIFTING)" },
  { category: "large", name: "5GB", validity: "3-30 Days", notes: "Corporate or gifting", providerName: "Glo 5.1GB incl 2GB Night 2 Days (GIFTING)" },
  { category: "large", name: "6GB", validity: "1-30 Days", notes: "GloTV or gifting", providerName: "Glo 6 GB for GLO TV 30 Days (GIFTING)" },
  { category: "large", name: "10GB", validity: "7-30 Days", notes: "Corporate or gifting", providerName: "Glo 10GB 7 Days (AWOOF)" },
  { category: "large", name: "12.5GB", validity: "30 Days", notes: "Includes night data", providerName: "Glo 12.5 GB incl. 2GB Night 30 Days (GIFTING)" },
  { category: "mega", name: "15GB", validity: "30 Days", notes: "Daily allocation", providerName: "Glo 15 GB (512 MB Daily) 30 Days (GIFTING)" },
  { category: "mega", name: "30GB", validity: "30 Days", notes: "1GB daily", providerName: "Glo 30 GB (1 GB Daily) 30 Days (GIFTING)" },
  { category: "mega", name: "45GB", validity: "30 Days", notes: "1.5GB daily", providerName: "Glo 45 GB (1.5 GB Daily) 30 Days (GIFTING)" },
  { category: "mega", name: "64GB", validity: "30 Days", notes: "Includes night data", providerName: "Glo 64 GB incl. 2GB Night 30 Days (GIFTING)" },
  { category: "mega", name: "107GB", validity: "30 Days", notes: "Includes night data", providerName: "Glo 107 GB incl. 2GB Night 30 Days (GIFTING)" },
  { category: "mega", name: "135GB", validity: "30 Days", notes: "Gifting option", providerName: "Glo 135GB 30 Days (GIFTING)" },
  { category: "mega", name: "165GB", validity: "30 Days", notes: "Gifting option", providerName: "Glo 165GB 30 Days (GIFTING)" },
  { category: "mega", name: "220GB", validity: "30 Days", notes: "Gifting option", providerName: "Glo 220 GB 30 Days (GIFTING)" },
  { category: "mega", name: "310GB", validity: "60 Days", notes: "Gifting option", providerName: "Glo 310 GB 60 Days (GIFTING)" },
  { category: "mega", name: "475GB", validity: "90 Days", notes: "Gifting option", providerName: "Glo 475GB 90 Days (GIFTING)" },
  { category: "mega", name: "1000GB", validity: "365 Days", notes: "Gifting option", providerName: "Glo 1000 GB 365 Days (GIFTING)" },
  { category: "unlimited", name: "Unlimited", validity: "30 Days", notes: "Gifting option", providerName: "Glo Unlimited Data 30 Days (GIFTING)" },
  { category: "unlimited", name: "Unlimited", validity: "60 Days", notes: "Gifting option", providerName: "Glo Unlimited Data 60 Days (GIFTING)" },
  { category: "unlimited", name: "Unlimited", validity: "90 Days", notes: "Gifting option", providerName: "Glo Unlimited Data 90 Days (GIFTING)" },
  { category: "unlimited", name: "Unlimited", validity: "180 Days", notes: "Gifting option", providerName: "Glo Unlimited Data 180 Days (GIFTING)" },
]);

dataBundles.forEach((bundle, index) => {
  const label = document.createElement("label");
  label.className = "bundle-option";
  label.innerHTML = `
    <input type="radio" name="bundle" value="${bundle.id}" ${index === 0 ? "checked" : ""}>
    <span>
      <strong class="bundle-value">${bundle.label}</strong>
      <small class="bundle-price">Price confirmed at checkout</small>
    </span>
  `;
  bundleGrid.appendChild(label);
});

function formatCurrency(value) {
  return `₦${Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
}

function detectNetwork(phone) {
  const prefix = phone.slice(0, 4);
  return Object.entries(prefixNetworks).find(([, prefixes]) => prefixes.includes(prefix))?.[0] || null;
}

function getSelectedBundle() {
  if (activeBundleTab === "glo") {
    const planIndex = Number(document.querySelector('input[name="gloPlan"]:checked')?.value);
    return Number.isInteger(planIndex) ? gloPlans[planIndex] : null;
  }
  const bundleId = document.querySelector('input[name="bundle"]:checked')?.value;
  return dataBundles.find((bundle) => bundle.id === bundleId);
}

function getPlanSizeInGb(planName) {
  const match = planName.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (match) return Number(match[1]);

  const mbMatch = planName.match(/(\d+(?:\.\d+)?)\s*MB/i);
  return mbMatch ? Number(mbMatch[1]) / 1024 : null;
}

function getGloCategory(plan) {
  if (/unlimited/i.test(plan.name)) return "unlimited";

  const size = getPlanSizeInGb(plan.name);
  if (size === null || size <= 0.5) return "small";
  if (size <= 2.5) return "medium";
  if (size <= 12.5) return "large";
  return "mega";
}

function getPlanValidity(planName) {
  const match = planName.match(/(\d+)\s*Days?/i);
  return match ? `${match[1]} Day${match[1] === "1" ? "" : "s"}` : "Provider plan";
}

function getPlanNotes(planName) {
  if (/unlimited/i.test(planName)) return "Gifting option";
  if (/night/i.test(planName)) return "Includes night data";
  if (/social|whatsapp|twitter|facebook|tiktok|instagram|youtube|glo tv/i.test(planName)) return "Social or GloTV option";
  if (/sme/i.test(planName)) return "SME or gifting";
  if (/corporate/i.test(planName)) return "Corporate or gifting";
  if (/awoof|weekend/i.test(planName)) return "Weekend/Awoof option";
  return "Gifting option";
}

function renderGloPlans() {
  gloPlanTable.innerHTML = "";
  const visiblePlans = gloPlans.filter((plan) => getGloCategory(plan) === activeGloCategory);

  if (visiblePlans.length) {
    const table = document.createElement("table");
    table.className = "glo-plan-table";
    table.innerHTML = `
      <thead><tr><th>Bundle</th><th>Validity</th><th>Notes</th><th>Price</th></tr></thead>
      <tbody></tbody>
    `;
    const body = table.querySelector("tbody");
    visiblePlans.forEach((plan, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><label class="glo-plan-choice"><input type="radio" name="gloPlan" value="${gloPlans.indexOf(plan)}" ${index === 0 ? "checked" : ""}><span>${plan.name}</span></label></td>
        <td>${plan.validity || getPlanValidity(plan.name)}</td>
        <td>${plan.notes || getPlanNotes(plan.name)}</td>
        <td>Price confirmed at checkout</td>
      `;
      body.appendChild(row);
    });
    gloPlanTable.appendChild(table);
  }

  gloPlansStatus.textContent = visiblePlans.length
    ? `Select one of the ${visiblePlans.length} ${activeGloCategory} Glo plans above.`
    : "No plans are available in this category.";
}

async function loadGloPlans() {
  gloPlans = [...gloCatalog];
  renderGloPlans();
}

document.querySelectorAll("[data-glo-category]").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeGloCategory = tab.dataset.gloCategory;
    document.querySelectorAll("[data-glo-category]").forEach((item) => {
      item.classList.toggle("active", item === tab);
    });
    renderGloPlans();
  });
});

document.querySelectorAll("[data-bundle-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeBundleTab = tab.dataset.bundleTab;
    document.querySelectorAll("[data-bundle-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.getElementById("standardBundles").classList.toggle("hidden", activeBundleTab !== "standard");
    document.getElementById("gloPlans").classList.toggle("hidden", activeBundleTab !== "glo");
    if (activeBundleTab === "glo") {
      document.querySelector('input[name="network"][value="GLO"]').checked = true;
      loadGloPlans();
    }
  });
});

function setLoading(isLoading) {
  buyButton.disabled = isLoading;
  buyButton.innerHTML = isLoading
    ? '<span class="spinner"></span> Processing data...'
    : "Buy data";
}

async function loadAccount() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    window.location.href = "login.html";
    return;
  }

  const { data, error } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("auth_id", userData.user.id)
    .single();

  if (!error && data) {
    currentBalance = Number(data.balance || 0);
    balanceEl.textContent = formatCurrency(currentBalance);
  }
}

phoneInput.addEventListener("input", () => {
  const phone = normalizePhone(phoneInput.value);
  const network = phone.length >= 4 ? detectNetwork(phone) : null;
  const selected = document.querySelector('input[name="network"]:checked')?.value;

  phoneHint.classList.remove("error");
  if (network) {
    detectedNetwork.textContent = `${network} detected`;
    if (selected && selected !== network) {
      phoneHint.textContent = `This number appears to be ${network}.`;
      phoneHint.classList.add("error");
    } else {
      phoneHint.textContent = "Network detected from the number prefix.";
    }
  } else {
    detectedNetwork.textContent = "Waiting for number";
    phoneHint.textContent = "Enter an 11-digit Nigerian number.";
  }
});

document.querySelectorAll('input[name="network"]').forEach((input) => {
  input.addEventListener("change", () => phoneInput.dispatchEvent(new Event("input")));
  input.addEventListener("change", () => {
    const targetTab = input.value === "GLO" ? "glo" : "standard";
    if (activeBundleTab !== targetTab) {
      document.querySelector(`[data-bundle-tab="${targetTab}"]`).click();
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "";
  messageEl.className = "message";

  const phone = normalizePhone(phoneInput.value);
  const selectedNetwork = document.querySelector('input[name="network"]:checked')?.value;
  const bundle = getSelectedBundle();
  const detected = detectNetwork(phone);

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    phoneHint.textContent = "Enter a valid 11-digit Nigerian number.";
    phoneHint.classList.add("error");
    return;
  }
  if (!selectedNetwork || !bundle) {
    messageEl.textContent = "Select a network and data bundle.";
    messageEl.classList.add("error");
    return;
  }
  if (selectedNetwork === "GLO" && (!bundle.name || activeBundleTab !== "glo")) {
    messageEl.textContent = "Choose a plan from the Glo category tabs.";
    messageEl.classList.add("error");
    document.querySelector('[data-bundle-tab="glo"]').click();
    return;
  }
  if (detected && detected !== selectedNetwork) {
    messageEl.textContent = `Wrong network. This number appears to be ${detected}, not ${selectedNetwork}.`;
    messageEl.classList.add("error");
    return;
  }
  setLoading(true);
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Your session has expired. Please log in again.");

    const response = await fetch(`${supabaseUrl}/functions/v1/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        phone,
        network: selectedNetwork,
        bundleId: bundle.id || "GLO_PLAN",
        bundleName: activeBundleTab === "glo" ? bundle.providerName : undefined,
      }),
    });

    const rawText = await response.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      throw new Error(`Data service returned HTTP ${response.status}: ${rawText}`);
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Data purchase failed.");
    }

    const chargedAmount = Number(result.chargedAmount || 0);
    currentBalance = typeof result.newBalance === "number"
      ? result.newBalance
      : currentBalance - chargedAmount;
    balanceEl.textContent = formatCurrency(currentBalance);
    const bundleLabel = bundle.name || bundle.label;
    successDetails.textContent = `${bundleLabel} data was sent successfully to ${phone}. You paid ${formatCurrency(chargedAmount)}. Your updated balance is ${formatCurrency(currentBalance)}.`;
    form.classList.add("hidden");
    successPanel.classList.remove("hidden");
    form.reset();
    detectedNetwork.textContent = "Waiting for number";
    phoneHint.textContent = "Enter an 11-digit Nigerian number.";
  } catch (error) {
    console.error("Data purchase error:", error);
    messageEl.textContent = error.message;
    messageEl.classList.add("error");
  } finally {
    setLoading(false);
  }
});

successOkButton.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});

loadAccount();
