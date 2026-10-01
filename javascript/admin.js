// =========================================================
// 1. SUPABASE INITIALIZATION
// =========================================================
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM References
const loginSection = document.getElementById("loginSection");
const dashboardWrapper = document.getElementById("dashboardWrapper");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginSpinner = document.getElementById("loginSpinner");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailDisplay = document.getElementById("userEmailDisplay");

// =========================================================
// 2. CHECK EXISTING SESSION ON PAGE LOAD
// =========================================================
async function initAuthCheck() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (session && session.user) {
    showDashboard(session.user);
  } else {
    showLogin();
  }
}

// Global state change listener
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    showDashboard(session.user);
  } else if (event === 'SIGNED_OUT') {
    showLogin();
  }
});

// =========================================================
// 3. LOGIN SUBMIT EVENT
// =========================================================
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.innerText = "";

    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      loginError.innerText = "Please enter both email and password.";
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      showDashboard(data.user);
    } catch (err) {
      console.error("Auth failed:", err.message);
      loginError.innerText = err.message || "Invalid email or password.";
    } finally {
      setLoading(false);
    }
  });
}

// =========================================================
// 4. LOGOUT EVENT
// =========================================================
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showLogin();
  });
}

// =========================================================
// 5. UI VIEW SWITCHERS
// =========================================================
function showDashboard(user) {
  loginSection.classList.add("hidden");
  dashboardWrapper.classList.remove("hidden");

  if (userEmailDisplay && user) {
    userEmailDisplay.innerText = user.email;
  }
}

function showLogin() {
  dashboardWrapper.classList.add("hidden");
  loginSection.classList.remove("hidden");
  loginError.innerText = "";
  if (loginPassword) loginPassword.value = "";
}

function setLoading(isLoading) {
  if (isLoading) {
    loginBtn.disabled = true;
    loginBtnText.innerText = "Signing in...";
    loginSpinner.classList.remove("hidden");
  } else {
    loginBtn.disabled = false;
    loginBtnText.innerText = "Log In";
    loginSpinner.classList.add("hidden");
  }
}

// Run auth check on DOM load
document.addEventListener("DOMContentLoaded", initAuthCheck);