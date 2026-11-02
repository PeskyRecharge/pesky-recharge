const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUserId = null;
let verifiedCustomerData = null;
let selectedAmount = 0;

function getReadableError(value, fallback = "Request failed") {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Error && value.message) return value.message;

  if (typeof value === "object") {
    const nestedKeys = ["message", "error", "detail", "description", "response_description", "content"];
    for (const key of nestedKeys) {
      if (value[key]) {
        const nested = getReadableError(value[key], "");
        if (nested) return nested;
      }
    }

    if (value.data) {
      const nested = getReadableError(value.data, "");
      if (nested) return nested;
    }

    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch (_) {}
  }

  return fallback;
}

// DOM Elements
const verifyForm = document.getElementById("verifyForm");
const discoSelect = document.getElementById("discoSelect");
const meterNumberInput = document.getElementById("meterNumberInput");
const verifyBtn = document.getElementById("verifyBtn");

const verifiedBox = document.getElementById("verifiedBox");
const custName = document.getElementById("custName");
const custAddress = document.getElementById("custAddress");

const amountSection = document.getElementById("amountSection");
const customAmountInput = document.getElementById("customAmountInput");
const purchaseBtn = document.getElementById("purchaseBtn");
const meterSection = document.getElementById("meterSection");
const flowProgress = document.getElementById("flowProgress");

const receiptModal = document.getElementById("receiptModal");
const receiptToken = document.getElementById("receiptToken");
const receiptUnits = document.getElementById("receiptUnits");
const receiptBand = document.getElementById("receiptBand");
const receiptAmount = document.getElementById("receiptAmount");
const receiptCustomer = document.getElementById("receiptCustomer");
const receiptOrderId = document.getElementById("receiptOrderId");
const copyTokenBtn = document.getElementById("copyTokenBtn");
const closeReceiptBtn = document.getElementById("closeReceiptBtn");

// 1. Initialize User Profile Session
async function initUser() {
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Authentication required. Redirecting...");
    setTimeout(() => { window.location.href = "/login.html"; }, 1500);
    return;
  }

  const { data: customer } = await supabaseClient
    .from("customers")
    .select("user_id, balance")
    .eq("email", user.email)
    .maybeSingle();

  if (customer) {
    currentUserId = customer.user_id;
    console.log("[Client Init] Authenticated user_id:", currentUserId);
  }
}

// 2. Step 1: Customer Meter Verification
verifyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const service_id = discoSelect.value;
  const variation_id = document.querySelector('input[name="meterType"]:checked').value;
  const customer_id = meterNumberInput.value.trim();

  if (!service_id || !customer_id) {
    showToast("Please select a DisCo and enter a valid meter number.");
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Verifying Meter...";
  verifiedBox.hidden = true;
  amountSection.hidden = true;

  const verifyPayload = {
    customer_id: String(customer_id),
    service_id: String(service_id),
    variation_id: String(variation_id)
  };

  console.log("========================================");
  console.log("[VERIFY METER REQUEST] Payload:", verifyPayload);
  console.log("========================================");

  try {
    let data;
    let error;

    for (let attempt = 1; attempt <= 2; attempt++) {
      ({ data, error } = await supabaseClient.functions.invoke("electricity", {
        body: {
          action: "verify",
          payload: verifyPayload
        }
      }));

      if (!error && !String(data?.message || "").includes("HTTP 503") && !String(data?.error || "").includes("HTTP 503")) {
        break;
      }

      if (attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log("========================================");
    console.log("[VERIFY METER RESPONSE]:", { data, error });
    console.log("========================================");

    if (error) {
      const invocationError = getReadableError(error);
      showToast(invocationError.includes("503")
        ? "Electricity provider is temporarily unavailable (HTTP 503). Please try again shortly."
        : "Edge Function Invocation Error: " + invocationError);
      return;
    }

    if (data && (data.code === "success" || data.status === "success")) {
      const info = data.data || {};
      verifiedCustomerData = {
        customer_id: customer_id,
        service_id: service_id,
        variation_id: variation_id,
        customer_name: info.customer_name || "Verified Customer",
        customer_address: info.customer_address || "N/A"
      };

      custName.textContent = verifiedCustomerData.customer_name;
      custAddress.textContent = verifiedCustomerData.customer_address;
      verifiedBox.hidden = false;
      amountSection.hidden = false;
      meterSection.hidden = true;
      flowProgress.querySelectorAll(".flow-step").forEach((step, index) => {
        step.classList.toggle("active", index === 0 || index === 1);
        step.classList.toggle("complete", index === 0);
      });
      amountSection.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Meter verified successfully!");
    } else {
      const errMsg = getReadableError(data?.message || data?.error || data?.data, "Meter verification failed.");
      if (/503|service unavailable|temporarily unavailable/i.test(errMsg)) {
        showToast("Electricity provider is temporarily unavailable (HTTP 503). Please try again shortly.");
      } else {
        showToast("Provider Error: " + errMsg);
      }
    }
  } catch (err) {
    console.error("[VERIFY EXCEPTION]:", err);
    showToast("Network failure during verification.");
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify Meter";
  }
});

// 3. Preset & Custom Amount Button Listeners
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedAmount = Number(btn.dataset.amount);
    customAmountInput.value = "";
    console.log("[Amount Selected]:", selectedAmount);
  });
});

customAmountInput.addEventListener("input", (e) => {
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
  selectedAmount = Number(e.target.value) || 0;
  console.log("[Custom Amount Entered]:", selectedAmount);
});

// 4. Step 2: Token Purchase Execution
purchaseBtn.addEventListener("click", async () => {
  if (!verifiedCustomerData) {
    showToast("Please verify meter first.");
    return;
  }

  const purchaseAmount = Number(selectedAmount);

  // Enforce DisCo Minimum Threshold (₦1,000)
  if (isNaN(purchaseAmount) || purchaseAmount < 1000 || purchaseAmount > 50000) {
    showToast("Minimum token purchase amount is ₦1,000.");
    return;
  }

  // Verify Wallet Balance
  const { data: customer, error: fetchError } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (fetchError || !customer) {
    showToast("Failed to retrieve user account balance.");
    return;
  }

  if (Number(customer.balance) < purchaseAmount) {
    showToast(`Insufficient balance. Wallet: ₦${parseFloat(customer.balance).toFixed(2)}, Required: ₦${purchaseAmount.toFixed(2)}`);
    return;
  }

  purchaseBtn.disabled = true;
  purchaseBtn.textContent = "Processing Purchase...";

  const requestId = `elec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const purchasePayload = {
    request_id: requestId,
    customer_id: String(verifiedCustomerData.customer_id),
    service_id: String(verifiedCustomerData.service_id),
    variation_id: String(verifiedCustomerData.variation_id),
    amount: purchaseAmount
  };

  console.log("========================================");
  console.log("[PURCHASE REQUEST] Payload:", purchasePayload);
  console.log("========================================");

  try {
    const { data, error } = await supabaseClient.functions.invoke("electricity", {
      body: {
        action: "purchase",
        payload: purchasePayload
      }
    });

    console.log("========================================");
    console.log("[PURCHASE EDGE RESPONSE]:", { data, error });
    console.log("========================================");

    if (error) {
      showToast("Edge Function Invocation Error: " + getReadableError(error));
      return;
    }

    const resultStatus = data?.data?.status || data?.status || "";
    const isSuccess = data && (data.code === "success" || resultStatus === "completed-api" || resultStatus === "processing-api");

    if (isSuccess) {
      const result = data.data || {};

      // Detect token state (Instant vs Async/Processing DisCo response)
      const displayToken = result.token || (resultStatus === "processing-api" ? "PROCESSING (Check SMS/Portal)" : "N/A");
      const displayUnits = result.units || (resultStatus === "processing-api" ? "Processing" : "N/A");
      const displayBand = result.band || (resultStatus === "processing-api" ? "Processing" : "N/A");

      // 1. Deduct user wallet balance
      const newBal = Number(customer.balance) - purchaseAmount;
      await supabaseClient
        .from("customers")
        .update({ balance: newBal })
        .eq("user_id", currentUserId);

      // 2. Log transaction in Supabase
      await supabaseClient.from("electricity_transactions").insert([{
        request_id: requestId,
        user_id: currentUserId,
        service_id: verifiedCustomerData.service_id,
        variation_id: verifiedCustomerData.variation_id,
        customer_id: verifiedCustomerData.customer_id,
        customer_name: result.customer_name || verifiedCustomerData.customer_name,
        customer_address: result.customer_address || verifiedCustomerData.customer_address,
        amount_paid: purchaseAmount,
        cost_price: Number(result.amount_charged || purchaseAmount),
        admin_margin: Number(result.discount || 0),
        token: displayToken,
        units: displayUnits,
        band: displayBand,
        status: resultStatus || "completed",
        api_response: data
      }]);

      // 3. Render Receipt Modal
      receiptToken.textContent = displayToken;
      receiptUnits.textContent = displayUnits;
      receiptBand.textContent = displayBand;
      receiptAmount.textContent = purchaseAmount.toFixed(2);
      receiptCustomer.textContent = result.customer_name || verifiedCustomerData.customer_name;
      receiptOrderId.textContent = result.order_id || "N/A";

      receiptModal.hidden = false;
      amountSection.hidden = true;
      flowProgress.querySelectorAll(".flow-step").forEach((step, index) => {
        step.classList.toggle("active", index === 2);
        step.classList.toggle("complete", index < 2);
      });
      receiptModal.scrollIntoView({ behavior: "smooth", block: "start" });

      showToast("Order submitted! DisCo is processing your token via SMS.");
    } else {
      const providerError = getReadableError(data?.message || data?.data?.message || data?.error || data, "Purchase failed.");
      console.error("[PURCHASE DECLINED REASON]:", providerError);
      showToast("IACafe Declined: " + providerError);
    }
  } catch (err) {
    console.error("[PURCHASE EXCEPTION]:", err);
    showToast("Processing error during token purchase.");
  } finally {
    purchaseBtn.disabled = false;
    purchaseBtn.textContent = "Purchase Token Now";
  }
});

// Helper utilities
copyTokenBtn.addEventListener("click", () => {
  if (receiptToken.textContent.includes("PROCESSING") || receiptToken.textContent === "N/A") {
    showToast("Token is currently being generated by the DisCo.");
    return;
  }
  navigator.clipboard.writeText(receiptToken.textContent).then(() => {
    showToast("Token copied to clipboard!");
  });
});

closeReceiptBtn.addEventListener("click", () => {
  receiptModal.hidden = true;
  window.location.reload();
});

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => { toast.className = "toast"; }, 4000);
}

document.addEventListener("DOMContentLoaded", initUser);