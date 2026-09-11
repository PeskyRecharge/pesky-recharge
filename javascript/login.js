const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co"
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy"
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

const form = document.getElementById("loginForm")
const loginBtn = form.querySelector('button[type="submit"]')
const successMessage = document.getElementById("successMessage")

function setButtonLoading(isLoading) {
  loginBtn.disabled = isLoading
  loginBtn.classList.toggle("loading", isLoading)
  loginBtn.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span>Signing in...'
    : "Sign In"
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "")
  return digits.startsWith("234") ? `0${digits.slice(3)}` : digits
}

form.addEventListener("submit", async function(e) {
  e.preventDefault()

  const phone = normalizePhone(document.getElementById("phone").value.trim())
  const password = document.getElementById("password").value

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    alert("Enter a valid Nigerian phone number.")
    return
  }

  if (!password) {
    alert("Enter your password.")
    return
  }

  setButtonLoading(true)

  try {
    const { data: lookup, error: lookupError } = await supabaseClient
      .rpc("get_login_email_by_phone", { phone_value: phone })

    if (lookupError || !lookup) {
      throw new Error("Phone number or password is incorrect.")
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: lookup,
      password
    })

    if (error || !data?.user) {
      throw new Error("Phone number or password is incorrect.")
    }

    try {
      if (notificationsEnabled(data.user.id, "login")) {
        showAccountNotification("Pesky Recharge login", { body: "Your account was accessed successfully." });
      }
    } catch (notificationError) {
      console.warn("Login notification failed:", notificationError)
    }

    successMessage.classList.remove("hidden")
    form.classList.add("hidden")
    window.location.href = "dashboard.html"
  } catch (err) {
    console.error("Login error:", err)
    alert(err.message || "Unable to sign in. Please try again.")
  } finally {
    setButtonLoading(false)
  }
})
