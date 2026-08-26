// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy"; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const historyList = document.getElementById("historyList");
let currentUser = null;

// Get logged-in user
async function getUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) {
    alert("You must be logged in to view history.");
    window.location.href = "login.html";
    return;
  }
  currentUser = data.user;
  loadHistory();
}

// Load deposits from customers.transactions and purchases from pin_purchases.
async function loadHistory() {
  try {
    historyList.innerHTML = "";

    const [purchaseResult, customerResult] = await Promise.all([
      supabaseClient
        .from("pin_purchases")
        .select("network, denomination, quantity, total_cost, pins, created_at")
        .eq("auth_id", currentUser.id)
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("customers")
        .select("transactions")
        .eq("auth_id", currentUser.id)
        .single()
    ]);

    if (purchaseResult.error) {
      console.error("Purchase history load error:", purchaseResult.error);
      historyList.innerHTML = "<li>Error loading history.</li>";
      return;
    }

    if (customerResult.error && customerResult.error.code !== "PGRST116") {
      console.error("Deposit history load error:", customerResult.error);
      historyList.innerHTML = "<li>Error loading history.</li>";
      return;
    }

    let transactions = customerResult.data?.transactions || [];
    if (typeof transactions === "string") {
      try { transactions = JSON.parse(transactions); } catch { transactions = []; }
    }

    const deposits = Array.isArray(transactions)
      ? transactions.filter(transaction => transaction.type === "deposit")
      : [];

    const entries = [
      ...deposits.map(deposit => ({ type: "deposit", date: deposit.date, deposit })),
      ...purchaseResult.data.map(purchase => ({ type: "purchase", date: purchase.created_at, purchase }))
    ].sort((first, second) => new Date(second.date) - new Date(first.date));

    if (entries.length === 0) {
      historyList.innerHTML = "<li>No deposits or purchases yet.</li>";
      return;
    }

    entries.forEach(entry => {
      const li = document.createElement("li");

      if (entry.type === "deposit") {
        li.innerHTML = `
          <strong>DEPOSIT</strong> - ₦${entry.deposit.amount}<br>
          Date: ${new Date(entry.date).toLocaleString()}
        `;
      } else {
        const purchase = entry.purchase;
        let pins = purchase.pins;
        if (typeof pins === "string") {
          try { pins = JSON.parse(pins); } catch { pins = []; }
        }
        const pinText = Array.isArray(pins) && pins.length
          ? pins.map(pin => `PIN: ${pin.pin || "N/A"} | Serial: ${pin.serial || "N/A"}`).join("<br>")
          : "No PIN details";

        li.innerHTML = `
          <strong>PURCHASE - ${String(purchase.network || "N/A").toUpperCase()}</strong><br>
          ₦${purchase.denomination} x ${purchase.quantity} (Total: ₦${purchase.total_cost})<br>
          Date: ${new Date(purchase.created_at).toLocaleString()}<br>
          <em>PINs:</em><br>${pinText}
        `;
      }

      historyList.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    historyList.innerHTML = "<li>Unexpected error loading history.</li>";
  }
}

// Initialize
getUser();
