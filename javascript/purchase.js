// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM elements
const balanceEl = document.getElementById("balance");
const purchaseForm = document.getElementById("purchaseForm");
const purchaseBtn = document.getElementById("purchaseBtn");
const messageEl = document.getElementById("message");
const depositRedirect = document.getElementById("depositRedirect");

const discountedPrices = Object.freeze({
  100: 98.50,
  200: 197.00,
  500: 492.50,
  1000: 985.00
});

const formatCurrency = (amount) => `₦${Number(amount).toFixed(2)}`;

document.querySelectorAll("#denomination option").forEach((option) => {
  const denomination = Number(option.value);
  const unitPrice = discountedPrices[denomination];
  if (unitPrice) {
    option.textContent = `${formatCurrency(denomination)} PIN - pay ${formatCurrency(unitPrice)}`;
  }
});

// Load balance
async function loadPurchaseData() {
  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      alert("You must be logged in.");
      window.location.href = "login.html";
      return;
    }

    const { data, error } = await supabaseClient
      .from("customers")
      .select("balance")
      .eq("auth_id", userData.user.id)
      .single();

    if (error) {
      console.error("Customer load error:", error.message, error.details);
      return;
    }

    if (data) {
      balanceEl.textContent = `₦${Number(data.balance || 0).toFixed(2)}`;
    }
  } catch (err) {
    console.error("Unexpected error loading purchase data:", err);
  }
}

// Handle purchase
purchaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  messageEl.innerHTML = "";
  depositRedirect.classList.add("hidden");

  const network = document.getElementById("network").value;
  const denomination = parseInt(document.getElementById("denomination").value);
  const quantity = parseInt(document.getElementById("quantity").value);

  if (!network || !denomination || !quantity) {
    messageEl.textContent = "Please fill all fields.";
    return;
  }

  const unitPrice = discountedPrices[denomination];
  if (typeof unitPrice === "undefined") {
    messageEl.textContent = "Please select a valid PIN value.";
    return;
  }

  const originalTotal = denomination * quantity;
  const totalCost = Number((unitPrice * quantity).toFixed(2));
  const discountAmount = Number((originalTotal - totalCost).toFixed(2));
  const currentBalance = parseFloat(balanceEl.textContent.replace(/[₦,]/g, "")) || 0;

  if (totalCost > currentBalance) {
    messageEl.textContent = "Insufficient balance.";
    depositRedirect.classList.remove("hidden");
    return;
  }

  // Get user + session for token
  const { data: userData } = await supabaseClient.auth.getUser();
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    messageEl.textContent = "You are not authenticated. Please log in again.";
    return;
  }

  purchaseBtn.disabled = true;
  purchaseBtn.classList.add("loading");
  purchaseBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processing purchase...';

  try {
    // Call Edge Function
    const res = await fetch(`${supabaseUrl}/functions/v1/pins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        userId: userData.user.id,
        userEmail: userData.user.email,
        network,
        denomination,
        quantity
      }),
    });

    const result = await res.json();

    if (result.success) {
      purchaseForm.classList.add("hidden");
      document.querySelector(".balance-box").classList.add("hidden");

      // Success message + button
      messageEl.innerHTML = `
        <p>Purchase successful. You bought ${quantity} PIN(s) at ${formatCurrency(unitPrice)} each.</p>
        <p>Original amount: ${formatCurrency(originalTotal)} | Discount: ${formatCurrency(discountAmount)} | Amount charged: <strong>${formatCurrency(totalCost)}</strong></p>
        <p><strong>Note:</strong> Check your purchase history to view your pins.</p>
        <button id="historyButton" class="btn-history">Go to Purchase History</button>
      `;

      // Add click handler for the new button
      const historyButton = document.getElementById("historyButton");
      historyButton.addEventListener("click", () => {
        window.location.href = "purchase-report.html";
      });

      // Update balance
      if (typeof result.newBalance !== "undefined") {
        balanceEl.textContent = `₦${Number(result.newBalance).toFixed(2)}`;
      } else {
        await loadPurchaseData();
      }

      // Record transaction
      const newTx = {
        type: "deduct",
        amount: totalCost,
        date: new Date().toISOString()
      };

      const { data: custData, error: custError } = await supabaseClient
        .from("customers")
        .select("transactions")
        .eq("auth_id", userData.user.id)
        .single();

      if (!custError) {
        const existingTxs = custData?.transactions || [];
        const updatedTxs = [...existingTxs, newTx];

        await supabaseClient
          .from("customers")
          .update({ transactions: updatedTxs })
          .eq("auth_id", userData.user.id);
      }
    } else {
      messageEl.textContent = `Purchase failed: ${result.message}`;
    }
  } catch (err) {
    console.error("Error calling pins function:", err);
    messageEl.textContent = "Purchase failed: Server error.";
  } finally {
    purchaseBtn.disabled = false;
    purchaseBtn.classList.remove("loading");
    purchaseBtn.textContent = "Purchase PINs";
  }
});

// Initialize
loadPurchaseData();

// Auto-refresh balance
setInterval(loadPurchaseData, 10000);
