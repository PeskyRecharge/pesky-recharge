const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const totalReferrals = document.getElementById("totalReferrals");
const totalEarned = document.getElementById("totalEarned");
const userCodeDisplay = document.getElementById("userCodeDisplay");
const referralLinkInput = document.getElementById("referralLinkInput");

const copyCodeBtn = document.getElementById("copyCodeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const whatsappBtn = document.getElementById("whatsappBtn");
const toast = document.getElementById("toastNotification");

let currentUserId = "";
let currentReferralUrl = "";

// Initialize User Profile Data
async function initReferralDashboard() {
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Authentication required. Redirecting...");
    setTimeout(() => { window.location.href = "/login.html"; }, 1500);
    return;
  }

  // Retrieve matching profile record from customers table
  const { data: customer, error: dbError } = await supabaseClient
    .from("customers")
    .select("user_id, total_referrals")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (dbError || !customer || !customer.user_id) {
    showToast("Error retrieving referral profile details.");
    return;
  }

  currentUserId = customer.user_id;
  const referralCount = customer.total_referrals || 0;
  const earnings = referralCount * 100;

  currentReferralUrl = `https://peskyrecharge.shop/create-account.html?ref=${currentUserId}`;

  // Populate UI
  userCodeDisplay.textContent = currentUserId;
  referralLinkInput.value = currentReferralUrl;
  totalReferrals.textContent = referralCount;
  totalEarned.textContent = `₦${earnings.toFixed(2)}`;
}

// Copy Code Helper
copyCodeBtn.addEventListener("click", () => {
  if (!currentUserId) return;
  navigator.clipboard.writeText(currentUserId).then(() => {
    showToast("Referral code copied to clipboard!");
  });
});

// Copy Link Helper
copyLinkBtn.addEventListener("click", () => {
  if (!currentReferralUrl) return;
  navigator.clipboard.writeText(currentReferralUrl).then(() => {
    showToast("Referral link copied to clipboard!");
  });
});

// WhatsApp Share Handler
whatsappBtn.addEventListener("click", () => {
  if (!currentReferralUrl) return;
  const message = encodeURIComponent(
    `Register on Pesky Recharge using my referral code *${currentUserId}* or click the link below to get started:\n${currentReferralUrl}`
  );
  window.open(`https://wa.me/?text=${message}`, "_blank");
});

function showToast(msg) {
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

document.addEventListener("DOMContentLoaded", initReferralDashboard);