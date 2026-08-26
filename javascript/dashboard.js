//  Redirect when clicking Me icon (bottom bar)
document.getElementById("meSection").addEventListener("click", () => {
  window.location.href = "deposit.html";
});

//  Redirect when clicking mini balance (top bar)
document.getElementById("balanceMini").addEventListener("click", () => {
  window.location.href = "deposit.html";
});

//  Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

//  Speak helper using Web Speech API
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "en-US";   // language/accent
  msg.pitch = 1;        // normal pitch
  msg.rate = 1;         // normal speed
  window.speechSynthesis.speak(msg);
}

//  Load balance and user info for dashboard
async function loadDashboardData() {
  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("User not logged in:", userError);
      return;
    }

    const { data, error } = await supabaseClient
      .from("customers")
      .select("other_name, balance")
      .eq("auth_id", userData.user.id)
      .single();

    if (error) {
      console.error("Customer load error:", error.message, error.details);
      return;
    }

    if (data) {
      //  Update balance display
      const balanceEl = document.getElementById("dashboardBalance");
      if (balanceEl) {
        balanceEl.textContent = `₦${data.balance || 0}`;
      }

      //  Speak greeting, sales pitch, and balance
      const name = data.other_name || "Friend";
      const balance = data.balance || 0;

      // Greeting
      speak(`Welcome to your dashboard, ${name}.`);

      // Sales pitch
      speak(
        "We sell recharge card pins for all networks: MTN, Glo, Airtel, and 9mobile, at affordable prices. " +
        "Our offers are: 100 naira recharge card for 98 point 50 kobo, 200 naira for 197  kobo, " +
        "500 naira for 492 point 5 kobo, and 1000 naira for 985  kobo. " +
        "Thank you for using Pesky Recharge. You can chat with us anytime for clarification."
      );

      // Current balance
      speak(`Your current balance is ₦${balance}.`);
    }
  } catch (err) {
    console.error("Unexpected error loading dashboard data:", err);
  }
}

//  Initialize data load
loadDashboardData();
setInterval(loadDashboardData, 10000);

//  Drawer toggle logic
const menuToggle = document.getElementById("menuToggle");
const drawer = document.getElementById("drawer");

menuToggle.addEventListener("click", () => {
  drawer.classList.toggle("open");
});

//  Close drawer when clicking outside
document.addEventListener("click", (event) => {
  if (drawer.classList.contains("open")) {
    const isClickInside = drawer.contains(event.target) || menuToggle.contains(event.target);
    if (!isClickInside) {
      drawer.classList.remove("open");
    }
  }
});

//  Logout button logic
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    // supabaseClient.auth.signOut();  // optional sign out
    window.location.href = "index.html";
  });
}

//  Hero slider logic
const slides = document.querySelectorAll(".hero-slider .slide");
let currentSlide = 0;

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.classList.remove("active");
    if (i === index) slide.classList.add("active");
  });
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
}

// Change slide every 4 seconds
setInterval(nextSlide, 4000);
