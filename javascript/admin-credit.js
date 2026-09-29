// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const loginSection = document.getElementById("loginSection");
const creditPanel = document.getElementById("creditPanel");

const lookupForm = document.getElementById("lookupForm");
const userDetails = document.getElementById("userDetails");
const detailName = document.getElementById("detailName");
const detailEmail = document.getElementById("detailEmail");
const detailBalance = document.getElementById("detailBalance");
const creditSection = document.getElementById("creditSection");
const creditForm = document.getElementById("creditForm");
const statusMessage = document.getElementById("statusMessage");

let currentUserId = null;

// Handle login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;

  loginStatus.textContent = "Signing in...";
  loginStatus.style.color = "#555";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginStatus.textContent = "Login failed: " + error.message;
    loginStatus.style.color = "red";
    return;
  }

  loginStatus.textContent = "Login successful!";
  loginStatus.style.color = "#0d6b57";

  // Show credit panel, hide login
  loginSection.hidden = true;
  creditPanel.hidden = false;
});

// Lookup user by 7-character user_id
lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Clear previous state
  statusMessage.textContent = "";
  userDetails.hidden = true;
  creditSection.hidden = true;
  currentUserId = null;

  const userId = document.getElementById("userIdInput").value.trim().toUpperCase();

  if (!userId) {
    statusMessage.textContent = "Please enter a valid User ID.";
    statusMessage.style.color = "red";
    return;
  }

  // Use .maybeSingle() to prevent 406 errors when user isn't found
  const { data, error } = await supabaseClient
    .from("customers")
    .select("surname, other_name, email, balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    statusMessage.textContent = "Lookup error: " + error.message;
    statusMessage.style.color = "red";
    console.error("Lookup Error:", error);
    return;
  }

  if (!data) {
    statusMessage.textContent = `No customer found with User ID: ${userId}`;
    statusMessage.style.color = "red";
    return;
  }

  // Store matched User ID and render user info
  currentUserId = userId;
  detailName.textContent = `${data.surname || ''} ${data.other_name || ''}`;
  detailEmail.textContent = data.email || "N/A";
  detailBalance.textContent = parseFloat(data.balance || 0).toFixed(2);

  userDetails.hidden = false;
  creditSection.hidden = false;
});

// Send credit and update balance in customers table
creditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amountInput = document.getElementById("amountInput");
  const amount = parseFloat(amountInput.value);

  if (!currentUserId) {
    statusMessage.textContent = "Please look up a valid user first.";
    statusMessage.style.color = "red";
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    statusMessage.textContent = "Please enter a valid amount greater than 0.";
    statusMessage.style.color = "red";
    return;
  }

  statusMessage.textContent = "Processing transaction...";
  statusMessage.style.color = "#555";

  // 1. Fetch current balance for the target user_id
  const { data: user, error: fetchError } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (fetchError || !user) {
    statusMessage.textContent = "Error fetching account balance.";
    statusMessage.style.color = "red";
    console.error("Fetch Balance Error:", fetchError);
    return;
  }

  const currentBalance = parseFloat(user.balance || 0);
  const newBalance = currentBalance + amount;

  // 2. Update balance and select updated rows to verify Supabase write
  const { data: updatedRows, error: updateError } = await supabaseClient
    .from("customers")
    .update({ balance: newBalance })
    .eq("user_id", currentUserId)
    .select(); // Returns updated array from Supabase

  if (updateError) {
    statusMessage.textContent = "Error updating balance: " + updateError.message;
    statusMessage.style.color = "red";
    console.error("Update Balance Error:", updateError);
    return;
  }

  // Check if RLS blocked the update or user was not matched
  if (!updatedRows || updatedRows.length === 0) {
    statusMessage.textContent = "Update failed. Check Row Level Security (RLS) policies in Supabase.";
    statusMessage.style.color = "red";
    return;
  }

  // 3. Render success state
  detailBalance.textContent = newBalance.toFixed(2);
  statusMessage.textContent = `Successfully credited ₦${amount.toFixed(2)}. New balance: ₦${newBalance.toFixed(2)}`;
  statusMessage.style.color = "#0d6b57";
  amountInput.value = "";
});