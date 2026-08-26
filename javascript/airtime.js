const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById("airtimeForm");
const phoneInput = document.getElementById("phone");
const phoneHint = document.getElementById("phoneHint");
const detectedNetwork = document.getElementById("detectedNetwork");
const balanceEl = document.getElementById("balance");
const messageEl = document.getElementById("message");
const buyButton = document.getElementById("buyAirtimeBtn");

const prefixNetworks = {
  MTN: ["0803", "0806", "0810", "0813", "0814", "0816", "0703", "0706", "0903", "0906", "0913", "0916"],
  GLO: ["0805", "0807", "0811", "0815", "0705", "0817", "0905"],
  AIRTEL: ["0802", "0808", "0812", "0701", "0708", "0901", "0902", "0904", "0907", "0912"],
  "9MOBILE": ["0809", "0817", "0818", "0908", "0909", "0818"]
};

let currentUser = null;
let currentBalance = 0;

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) return `0${digits.slice(3)}`;
  return digits;
}

function detectNetwork(phone) {
  const prefix = phone.slice(0, 4);
  return Object.entries(prefixNetworks).find(([, prefixes]) => prefixes.includes(prefix))?.[0] || null;
}

function setLoading(isLoading) {
  buyButton.disabled = isLoading;
  buyButton.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span>Processing airtime...'
    : "Buy airtime";
}

async function loadAccount() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = userData.user;

  const { data, error } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("auth_id", currentUser.id)
    .single();

  if (!error && data) {
    currentBalance = Number(data.balance || 0);
    balanceEl.textContent = `₦${currentBalance.toFixed(2)}`;
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

document.querySelectorAll('input[name="network"]').forEach(input => {
  input.addEventListener("change", () => phoneInput.dispatchEvent(new Event("input")));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "";
  messageEl.className = "message";

  const phone = normalizePhone(phoneInput.value);
  const selectedNetwork = document.querySelector('input[name="network"]:checked')?.value;
  const amount = Number(document.querySelector('input[name="amount"]:checked')?.value);
  const detected = detectNetwork(phone);

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    phoneHint.textContent = "Enter a valid 11-digit Nigerian number.";
    phoneHint.classList.add("error");
    return;
  }
  if (!selectedNetwork || !amount) {
    messageEl.textContent = "Select a network and airtime amount.";
    messageEl.classList.add("error");
    return;
  }
  if (detected && detected !== selectedNetwork) {
    messageEl.textContent = `Wrong network. This number appears to be ${detected}, not ${selectedNetwork}.`;
    messageEl.classList.add("error");
    return;
  }
  if (amount > currentBalance) {
    messageEl.textContent = "Insufficient balance. Please deposit first.";
    messageEl.classList.add("error");
    return;
  }

  setLoading(true);
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Your session has expired. Please log in again.");

    const response = await fetch(`${supabaseUrl}/functions/v1/airtime`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ userId: currentUser.id, phone, network: selectedNetwork, amount })
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Airtime service returned HTTP ${response.status}.`);
    }
    if (!response.ok || !result.success) throw new Error(result.message || "Airtime purchase failed.");

    currentBalance = typeof result.newBalance === "number" ? result.newBalance : currentBalance - amount;
    balanceEl.textContent = `₦${currentBalance.toFixed(2)}`;
    messageEl.textContent = `Airtime sent successfully to ${phone}.`;
    form.reset();
    detectedNetwork.textContent = "Waiting for number";
    phoneHint.textContent = "Enter an 11-digit Nigerian number.";
  } catch (error) {
    console.error("Airtime purchase error:", error);
    messageEl.textContent = error instanceof TypeError && error.message === "Failed to fetch"
      ? "Airtime service is not connected yet. Please contact support."
      : error.message;
    messageEl.classList.add("error");
  } finally {
    setLoading(false);
  }
});

loadAccount();
