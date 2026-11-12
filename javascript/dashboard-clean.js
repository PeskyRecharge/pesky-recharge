// Dashboard authentication, balance, and logout
(() => {
  const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
  const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
  const client = window.supabase.createClient(supabaseUrl, supabaseKey);

  function formatBalance(value) {
    return `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  async function loadDashboard() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    const user = sessionData?.session?.user;

    if (sessionError || !user) {
      window.location.replace("login.html");
      return;
    }

    const { data, error } = await client
      .from("customers")
      .select("balance")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Unable to load dashboard balance:", error);
      return;
    }

    const balance = formatBalance(data?.balance ?? 0);
    const walletBalance = document.getElementById("walletBalance");
    const dashboardBalance = document.getElementById("dashboardBalance");
    if (walletBalance) walletBalance.textContent = balance;
    if (dashboardBalance) dashboardBalance.textContent = balance;
  }

  const logoutButton = document.getElementById("logoutBtn");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      try {
        await client.auth.signOut({ scope: "global" });
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        sessionStorage.clear();
        window.location.replace("login.html");
      }
    });
  }

  loadDashboard();
  setInterval(loadDashboard, 10000);
})();
