const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const loginSection = document.getElementById("loginSection");
const dashboardWrapper = document.getElementById("dashboardWrapper");

// Check session on page load
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    // Already logged in → show dashboard
    loginSection.classList.add("hidden");
    dashboardWrapper.classList.remove("hidden");

    // Load data
    loadUsers();
    loadDeposits();
    loadPurchases();
  } else {
    // No session → show login
    loginSection.classList.remove("hidden");
    dashboardWrapper.classList.add("hidden");
  }
})();

//  Login
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    document.getElementById("loginError").textContent = "Login failed: " + error.message;
    return;
  }

  // Success: show dashboard
  loginSection.classList.add("hidden");
  dashboardWrapper.classList.remove("hidden");

  loadUsers();
  loadDeposits();
  loadPurchases();
});

//  Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  dashboardWrapper.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

//  Menu links
document.getElementById("usersLink").addEventListener("click", () => showSection("usersSection"));
document.getElementById("depositsLink").addEventListener("click", () => showSection("depositsSection"));
document.getElementById("purchasesLink").addEventListener("click", () => showSection("purchasesSection"));
document.getElementById("settingsLink").addEventListener("click", () => showSection("settingsSection"));

function showSection(sectionId) {
  ["dashboardSection","usersSection","depositsSection","purchasesSection","settingsSection"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(sectionId).classList.remove("hidden");
}

// Load users
async function loadUsers() {
  const { data, error } = await supabaseClient.from("customers").select("surname, other_name, email, balance");
  if (error) {
    console.error("Error loading users:", error);
    return;
  }
  const tbody = document.querySelector("#usersTable tbody");
  tbody.innerHTML = "";
  data.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${user.surname}</td><td>${user.other_name}</td><td>${user.email}</td><td>₦${user.balance || 0}</td>`;
    tbody.appendChild(tr);
  });
}

// Load deposits
async function loadDeposits() {
  const { data, error } = await supabaseClient.from("customers").select("transactions, email");
  if (error) {
    console.error("Error loading deposits:", error);
    return;
  }
  const list = document.getElementById("depositsList");
  list.innerHTML = "";
  data.forEach(user => {
    if (user.transactions) {
      user.transactions.filter(tx => tx.type === "deposit").forEach(tx => {
        const li = document.createElement("li");
        li.textContent = `${user.email} deposited ₦${tx.amount} on ${new Date(tx.date).toLocaleString()}`;
        list.appendChild(li);
      });
    }
  });
}

// Load purchases
async function loadPurchases() {
  const { data, error } = await supabaseClient.from("customers").select("transactions, email");
  if (error) {
    console.error("Error loading purchases:", error);
    return;
  }
  const list = document.getElementById("purchasesList");
  list.innerHTML = "";
  data.forEach(user => {
    if (user.transactions) {
      user.transactions.filter(tx => tx.type === "deduct").forEach(tx => {
        const li = document.createElement("li");
        li.textContent = `${user.email} purchased ₦${tx.amount} on ${new Date(tx.date).toLocaleString()}`;
        list.appendChild(li);
      });
    }
  });
}
