const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co"
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy"
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

const form = document.getElementById("loginForm")
const loginBtn = form.querySelector('button[type="submit"]')
const successMessage = document.getElementById("successMessage")
const forgotPasswordLink = document.getElementById("forgotPasswordLink")
const passwordResetSection = document.getElementById("passwordResetSection")
const resetEmailForm = document.getElementById("resetEmailForm")
const resetCodeForm = document.getElementById("resetCodeForm")
const newPasswordForm = document.getElementById("newPasswordForm")
const resetMessage = document.getElementById("resetMessage")
const cancelResetButton = document.getElementById("cancelResetButton")

let resetEmail = ""

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

function setResetStep(step) {
  resetEmailForm.classList.toggle("hidden", step !== "email")
  resetCodeForm.classList.toggle("hidden", step !== "code")
  newPasswordForm.classList.toggle("hidden", step !== "password")
}

function setFormButtonLoading(currentForm, isLoading, loadingText, defaultText) {
  const button = currentForm.querySelector('button[type="submit"]')
  button.disabled = isLoading
  button.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span>' + loadingText
    : defaultText
}

forgotPasswordLink.addEventListener("click", function() {
  form.classList.add("hidden")
  forgotPasswordLink.classList.add("hidden")
  passwordResetSection.classList.remove("hidden")
  setResetStep("email")
  resetMessage.textContent = "Enter your account email and we will send you a verification code."
  document.getElementById("resetEmail").focus()
})

cancelResetButton.addEventListener("click", function() {
  passwordResetSection.classList.add("hidden")
  form.classList.remove("hidden")
  forgotPasswordLink.classList.remove("hidden")
})

resetEmailForm.addEventListener("submit", async function(event) {
  event.preventDefault()
  resetEmail = document.getElementById("resetEmail").value.trim().toLowerCase()
  setFormButtonLoading(resetEmailForm, true, "Sending...", "Send verification code")

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: resetEmail,
      options: { shouldCreateUser: false }
    })

    if (error) throw error

    setResetStep("code")
    resetMessage.textContent = "A verification code was sent to your email. Enter it below to continue."
    document.getElementById("resetCode").focus()
  } catch (error) {
    console.error("Password reset email error:", error)
    alert("We could not send a code to that email. Check the address and try again.")
  } finally {
    setFormButtonLoading(resetEmailForm, false, "Sending...", "Send verification code")
  }
})

resetCodeForm.addEventListener("submit", async function(event) {
  event.preventDefault()
  const code = document.getElementById("resetCode").value.trim()
  setFormButtonLoading(resetCodeForm, true, "Verifying...", "Verify code")

  try {
    const { error } = await supabaseClient.auth.verifyOtp({
      email: resetEmail,
      token: code,
      type: "email"
    })

    if (error) throw error

    setResetStep("password")
    resetMessage.textContent = "Code verified. Create a new password for your account."
    document.getElementById("newPassword").focus()
  } catch (error) {
    console.error("Password reset code error:", error)
    alert("That code is invalid or expired. Please request a new code.")
  } finally {
    setFormButtonLoading(resetCodeForm, false, "Verifying...", "Verify code")
  }
})

newPasswordForm.addEventListener("submit", async function(event) {
  event.preventDefault()
  const newPassword = document.getElementById("newPassword").value
  const confirmPassword = document.getElementById("confirmPassword").value

  if (newPassword.length < 6) {
    alert("Your new password must be at least 6 characters.")
    return
  }

  if (newPassword !== confirmPassword) {
    alert("The passwords do not match.")
    return
  }

  setFormButtonLoading(newPasswordForm, true, "Saving...", "Save new password")

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword })
    if (error) throw error

    resetMessage.textContent = "Password updated successfully. Redirecting to your dashboard..."
    newPasswordForm.classList.add("hidden")
    cancelResetButton.classList.add("hidden")
    setTimeout(() => { window.location.href = "dashboard.html" }, 900)
  } catch (error) {
    console.error("Password update error:", error)
    alert(error.message || "Unable to update your password. Please try again.")
  } finally {
    setFormButtonLoading(newPasswordForm, false, "Saving...", "Save new password")
  }
})

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
