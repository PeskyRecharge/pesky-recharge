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
  const email = document.getElementById("emailInput").value;
  const password = document.getElementById("passwordInput").value;

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

// Lookup user by ID
lookupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = document.getElementById("userIdInput").value.trim();

  const { data, error } = await supabaseClient
    .from("customers")
    .select("surname, other_name, email, balance")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    statusMessage.textContent = "User not found.";
    return;
  }

  currentUserId = userId;
  detailName.textContent = `${data.surname} ${data.other_name}`;
  detailEmail.textContent = data.email;
  detailBalance.textContent = parseFloat(data.balance).toFixed(2);

  userDetails.hidden = false;
  creditSection.hidden = false;
});

// Send credit
creditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amountInput").value);

  const { data: user, error: fetchError } = await supabaseClient
    .from("customers")
    .select("balance")
    .eq("user_id", currentUserId)
    .single();

  if (fetchError || !user) {
    statusMessage.textContent = "Error fetching balance.";
    return;
  }

  const newBalance = parseFloat(user.balance) + amount;

  const { error: updateError } = await supabaseClient
    .from("customers")
    .update({ balance: newBalance })
    .eq("user_id", currentUserId);

  if (updateError) {
    statusMessage.textContent = "Error updating balance.";
    console.error(updateError);
    return;
  }

  detailBalance.textContent = newBalance.toFixed(2);
  statusMessage.textContent = `Successfully sent ₦${amount.toFixed(2)}. New balance: ₦${newBalance.toFixed(2)}`;
});
