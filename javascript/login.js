const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co"
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy"
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

const form = document.getElementById("loginForm")
const loginBtn = form.querySelector('button[type="submit"]')
const otpSection = document.getElementById("otpSection")
const verifyBtn = document.getElementById("verifyBtn")
const successMessage = document.getElementById("successMessage")

function setButtonLoading(button, text) {
  button.disabled = true
  button.classList.add("loading")
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${text}`
}

function resetButton(button, text) {
  button.disabled = false
  button.classList.remove("loading")
  button.textContent = text
}

form.addEventListener("submit", async function(e) {
  e.preventDefault()
  console.log("Login form submitted")

  const email = document.getElementById("email").value.trim()
  setButtonLoading(loginBtn, "Sending OTP...")

  try {
    // Send OTP for login (Supabase will error if user doesn't exist)
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false // login only
      }
    })

    if (error) {
      alert("Email doesn't exist. Please sign up first.")
      return
    }

    // Show OTP section
    form.classList.add("hidden")
    otpSection.classList.remove("hidden")
  } catch (err) {
    console.error("Error sending login OTP:", err)
    alert("Unable to send OTP. Please try again.")
  } finally {
    resetButton(loginBtn, "Login")
  }
})

verifyBtn.addEventListener("click", async function() {
  const code = document.getElementById("code").value.trim()
  const email = document.getElementById("email").value.trim()
  setButtonLoading(verifyBtn, "Verifying...")

  try {
    // Verify OTP
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: email,
      token: code,
      type: "email"
    })

    if (error) {
      alert("Error verifying: " + error.message)
      return
    }

    if (data?.user) {
      try {
        if (notificationsEnabled(data.user.id, "login")) {
          showAccountNotification("Pesky Recharge login", { body: "Your account was accessed successfully." });
        }
      } catch (notificationError) {
        console.warn("Login notification failed:", notificationError)
      }

      successMessage.classList.remove("hidden")
      otpSection.classList.add("hidden")

      window.location.href = "dashboard.html"
    } else {
      alert("Invalid code. Please try again.")
    }
  } catch (err) {
    console.error("Error verifying login:", err)
    alert("Unable to verify login. Please try again.")
  } finally {
    resetButton(verifyBtn, "Verify OTP")
  }
  }
)
