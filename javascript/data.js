const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById("dataForm");
const phoneInput = document.getElementById("phone");
const phoneHint = document.getElementById("phoneHint");
const detectedNetwork = document.getElementById("detectedNetwork");
const balanceEl = document.getElementById("balance");
const bundleGrid = document.getElementById("bundleGrid");
const planCount = document.getElementById("planCount");
const planSearch = document.getElementById("planSearch");
const messageEl = document.getElementById("message");
const buyButton = document.getElementById("buyDataBtn");
const successPanel = document.getElementById("successPanel");
const successDetails = document.getElementById("successDetails");
const successOkButton = document.getElementById("successOkButton");

const prefixNetworks = {
  MTN: ["0803", "0806", "0810", "0813", "0814", "0816", "0703", "0706", "0903", "0906", "0913", "0916"],
  GLO: ["0805", "0807", "0811", "0815", "0705", "0905", "0915"],
  AIRTEL: ["0802", "0808", "0812", "0701", "0708", "0901", "0902", "0904", "0907", "0912"],
  "9MOBILE": ["0809", "0817", "0818", "0908", "0909"],
};

let currentBalance = 0;
let currentPlans = [];
let visiblePlans = [];

function formatCurrency(value) {
  return `₦${Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
}

function detectNetwork(phone) {
  const prefix = phone.slice(0, 4);
  return Object.entries(prefixNetworks)
    .find(([, prefixes]) => prefixes.includes(prefix))?.[0] || null;
}

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = isError ? "message error" : "message";
}

function setLoading(isLoading) {
  buyButton.disabled = isLoading;
  buyButton.innerHTML = isLoading
    ? '<span class="spinner"></span> Processing data...'
    : "Buy data";
}

function planSizeInMb(plan) {
  const name = String(plan.name || "").toLowerCase();
  const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*(?:gb|gig)\b/);
  const mbMatch = name.match(/(\d+(?:\.\d+)?)\s*mb\b/);

  if (gbMatch) return Number(gbMatch[1]) * 1024;
  if (mbMatch) return Number(mbMatch[1]);
  return Number.POSITIVE_INFINITY;
}

function planGroup(plan) {
  const text = `${plan.name || ""} ${plan.data_type || ""}`.toLowerCase();
  return text.includes("awoof") ? 1 : 0;
}

function featuredPlanRank(plan, network) {
  const text = String(plan.name || "").toLowerCase();
  const type = String(plan.data_type || "").toLowerCase();
  const validity = `${text} ${String(plan.validity || "").toLowerCase()}`;

  if (network === "MTN") {
    if (text.includes("2gb") && validity.includes("7") && type.includes("sme")) return 0;
    if (text.includes("3gb") && validity.includes("30") && type.includes("sme")) return 1;
    if (text.includes("5gb") && validity.includes("30") && type.includes("sme")) return 2;
    if (text.includes("2gb") && validity.includes("30")) return 3;
    return 5;
  }

  if (network === "AIRTEL") {
    if (text.includes("1.5gb") && validity.includes("1") && type.includes("sme")) return 0;
    if (text.includes("3gb") && validity.includes("1")) return 1;
    if (text.includes("1.5gb") && validity.includes("2") && type.includes("sme")) return 2;
    return 5;
  }

  if (text.includes("750mb") && text.includes("sme")) return 0;
  if (text.includes("1.5gb") || text.includes("1.6gb")) return 1;
  if (text.includes("2.5gb")) return 2;
  return 5;
}

function displayPlanRank(plan, network) {
  const featuredRank = featuredPlanRank(plan, network);
  if (featuredRank < 5) return featuredRank;
  return planGroup(plan) === 1 ? 4 : 5;
}

function renderPlans(plans, network) {
  currentPlans = plans
    .filter((plan) => String(plan.data_type || "").toLowerCase() !== "corporate")
    .sort((left, right) => {
    const displayDifference = displayPlanRank(left, network) - displayPlanRank(right, network);
    if (displayDifference !== 0) return displayDifference;
    const sizeDifference = planSizeInMb(left) - planSizeInMb(right);
    if (sizeDifference !== 0) return sizeDifference;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
  const query = planSearch.value.trim().toLowerCase();
  visiblePlans = currentPlans.filter((plan) => {
    const text = `${plan.name} ${plan.validity || ""} ${plan.data_type || ""}`.toLowerCase();
    return !query || text.includes(query);
  });
  planCount.textContent = `${visiblePlans.length} of ${currentPlans.length} plans`;

  if (!currentPlans.length) {
    bundleGrid.innerHTML = '<p class="field-hint">No data plans are available for this network.</p>';
    return;
  }

  if (!visiblePlans.length) {
    bundleGrid.innerHTML = '<p class="field-hint">No plans match your search.</p>';
    return;
  }

  bundleGrid.innerHTML = visiblePlans.map((plan, index) => `
    <label class="bundle-option">
      <input type="radio" name="bundle" value="${plan.data_plan}" ${index === 0 ? "checked" : ""}>
      <span>
        <strong class="bundle-value">${plan.name}</strong>
        <small class="bundle-price">${formatCurrency(plan.price)}${plan.validity ? ` · ${plan.validity}` : ""}</small>
        ${plan.data_type ? `<small class="bundle-type">${plan.data_type}</small>` : ""}
      </span>
    </label>`).join("");
}

async function loadPlans(network) {
  if (!network) {
    currentPlans = [];
    visiblePlans = [];
    planCount.textContent = "";
    bundleGrid.innerHTML = `
      <div class="plans-empty" role="status">
        <span class="plans-empty-icon" aria-hidden="true">&#128241;</span>
        <strong>Enter a phone number</strong>
        <small>Available data plans will appear here.</small>
      </div>`;
    return;
  }

  bundleGrid.innerHTML = `
    <div class="plans-loading" role="status" aria-live="polite">
      <span class="plans-loading-spinner" aria-hidden="true"></span>
      <span>
        <strong>Loading available plans</strong>
        <small>Checking the latest bundles for ${network}</small>
      </span>
    </div>`;

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
      body: JSON.stringify({ action: "plans", network }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      if (result.providerResponse) {
        console.error("IA-Café plans response:", result.providerResponse);
      }
      const available = Array.isArray(result.availablePlans)
        ? ` Available plans: ${result.availablePlans.map((plan) => plan.name || plan).join(", ")}`
        : "";
      throw new Error(`${result.message || "Unable to load data plans."}${available}`);
    }

    renderPlans(result.plans || [], network);
  } catch (error) {
    currentPlans = [];
    bundleGrid.innerHTML = "";
    const errorText = document.createElement("p");
    errorText.className = "field-hint error";
    errorText.textContent = error.message || "Unable to load plans.";
    bundleGrid.appendChild(errorText);
    console.error("Data plans error:", error);
  }
}

function updateNetworkState() {
  const phone = normalizePhone(phoneInput.value);
  const network = phone.length >= 4 ? detectNetwork(phone) : null;
  const selected = document.querySelector('input[name="network"]:checked')?.value;

  phoneHint.classList.remove("error");

  if (!network) {
    detectedNetwork.textContent = "Waiting for number";
    phoneHint.textContent = "Enter an 11-digit Nigerian number.";
    loadPlans(null);
    return;
  }

  detectedNetwork.textContent = `${network} detected`;

  if (selected && selected !== network) {
    phoneHint.textContent = `This number appears to be ${network}.`;
    phoneHint.classList.add("error");
    return;
  }

  const networkInput = document.querySelector(`input[name="network"][value="${network}"]`);
  if (networkInput) networkInput.checked = true;

  phoneHint.textContent = "Network detected from the number prefix.";
  loadPlans(network);
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

phoneInput.addEventListener("input", updateNetworkState);

document.querySelectorAll('input[name="network"]').forEach((input) => {
  input.addEventListener("change", () => {
    const network = input.value;
    detectedNetwork.textContent = `${network} selected`;
    loadPlans(network);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const phone = normalizePhone(phoneInput.value);
  const selectedNetwork = document.querySelector('input[name="network"]:checked')?.value;
  const selectedPlanId = Number(document.querySelector('input[name="bundle"]:checked')?.value);
  const selectedPlan = currentPlans.find((plan) => plan.data_plan === selectedPlanId);
  const detected = detectNetwork(phone);

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    phoneHint.textContent = "Enter a valid 11-digit Nigerian number.";
    phoneHint.classList.add("error");
    return;
  }

  if (!selectedNetwork || !selectedPlan) {
    setMessage("Select a network and data plan.", true);
    return;
  }

  if (detected && detected !== selectedNetwork) {
    setMessage(`Wrong network. This number appears to be ${detected}, not ${selectedNetwork}.`, true);
    return;
  }

  if (selectedPlan.price > currentBalance) {
    setMessage("Insufficient balance. Please deposit first.", true);
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
        data_plan: selectedPlan.data_plan,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      if (result.providerResponse) console.error("IA-Café response:", result.providerResponse);
      throw new Error(result.message || "Data purchase failed.");
    }

    currentBalance = Number(result.newBalance);
    balanceEl.textContent = formatCurrency(currentBalance);
    successDetails.textContent = `${result.bundle || selectedPlan.name} was sent successfully to ${phone}. You paid ${formatCurrency(result.chargedAmount)}. Your updated balance is ${formatCurrency(currentBalance)}.`;
    form.classList.add("hidden");
    successPanel.classList.remove("hidden");
  } catch (error) {
    console.error("Data purchase error:", error);
    setMessage(error.message || "Data purchase failed.", true);
  } finally {
    setLoading(false);
  }
});

successOkButton.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});

bundleGrid.innerHTML = `
  <div class="plans-empty" role="status">
    <span class="plans-empty-icon" aria-hidden="true">&#128241;</span>
    <strong>Enter a phone number</strong>
    <small>Available data plans will appear here.</small>
  </div>`;
planSearch.addEventListener("input", () => renderPlans(currentPlans));
loadAccount();
