//  Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy"; // anon/publishable key for frontend
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

//  Paystack public key (frontend only)
const paystackPublicKey = "pk_live_c9ee73e26b910173a36d5aac458801a53f667f26";

//  DOM elements
const depositBtn = document.getElementById("depositBtn");
const amountSection = document.getElementById("amountSection");
const confirmDepositBtn = document.getElementById("confirmDepositBtn");
const balanceEl = document.getElementById("balance");

let currentUser = null;
let currentBalance = 0;

//  Get logged-in user
async function getUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) {
    alert("You must be logged in to deposit.");
    window.location.href = "login.html";
    return;
  }
  currentUser = data.user;
  await loadBalance();
}

//  Load balance from customers table
async function loadBalance() {
  try {
    const { data, error } = await supabaseClient
      .from("customers")
      .select("balance")
      .eq("auth_id", currentUser.id)
      .single();

    if (error || !data) {
      console.warn("No customer row found:", error);
      currentBalance = 0;
    } else {
      currentBalance = data.balance || 0;
    }

    balanceEl.textContent = `₦${Number(currentBalance).toFixed(2)}`;
  } catch (err) {
    console.error("Balance load error:", err);
  }
}

//  Show amount input
depositBtn.addEventListener("click", () => {
  depositBtn.classList.add("hidden");
  amountSection.classList.remove("hidden");
});

//  Confirm deposit → Paystack popup
confirmDepositBtn.addEventListener("click", () => {
  const amountField = document.getElementById("depositAmount");
  const amount = parseInt(amountField.value);

  if (!amount || amount < 100) {
    alert("Minimum deposit is ₦100");
    return;
  }

  let handler = PaystackPop.setup({
    key: paystackPublicKey,
    email: currentUser?.email || "test@example.com",
    amount: amount * 100, // Paystack expects kobo
    currency: "NGN",
    channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
    callback: function (response) {
      //  Call Supabase Edge Function to verify payment
      fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: response.reference,
          userId: currentUser.id,
          amount,
        }),
      })
        .then((res) => res.json())
        .then(async (result) => {
          if (result.success) {
            if (notificationsEnabled(currentUser.id, "activity")) {
              showAccountNotification("Deposit successful", { body: `₦${amount.toFixed(2)} was added to your balance.` });
            }
            //  Update balance display
            if (typeof result.newBalance !== "undefined") {
              balanceEl.textContent = `₦${Number(result.newBalance).toFixed(2)}`;
            } else {
              await loadBalance();
            }

            //  Add transaction record to customers.transactions
            const newTx = {
              type: "deposit",
              amount: amount,
              date: new Date().toISOString()
            };

            // Fetch existing transactions
            const { data: custData, error: custError } = await supabaseClient
              .from("customers")
              .select("transactions")
              .eq("auth_id", currentUser.id)
              .single();

            if (custError) {
              console.error("Fetch transactions error:", custError);
            } else {
              const existingTxs = custData?.transactions || [];
              const updatedTxs = [...existingTxs, newTx];

              const { error: updateError } = await supabaseClient
                .from("customers")
                .update({ transactions: updatedTxs })
                .eq("auth_id", currentUser.id);

              if (updateError) {
                console.error("Failed to append transaction:", updateError);
              }
            }

            //  Redirect after success
            window.location.href = "dashboard.html";
          } else {
            console.error("Verification failed:", result.message);
            alert("Verification failed. Please try again.");
          }
        })
        .catch((err) => console.error("Verify error:", err));
    },
    onClose: function () {
      alert("Payment window closed.");
    },
  });

  handler.openIframe();
});

//  Initialize
getUser();
