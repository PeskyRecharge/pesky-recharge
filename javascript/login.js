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
const networkModal = document.getElementById("networkModal")
const networkModalTitle = document.getElementById("networkModalTitle")
const networkModalMessage = document.getElementById("networkModalMessage")
const networkOkayBtn = document.getElementById("networkOkayBtn")
const passkeyLoginSection = document.getElementById("passkeyLoginSection")
const passkeyLoginBtn = document.getElementById("passkeyLoginBtn")
const showPasswordLoginBtn = document.getElementById("showPasswordLoginBtn")
const usePasskeyLoginBtn = document.getElementById("usePasskeyLoginBtn")
const loginMethodStatus = document.getElementById("loginMethodStatus")

let resetEmail = ""
let networkReturnFocus = null

function isNetworkError(error) {
  return !navigator.onLine || /failed to fetch|network error|network request failed|load failed/i.test(error?.message || "")
}

function showFeedbackModal(title, message, returnFocusTarget = document.activeElement) {
  networkReturnFocus = returnFocusTarget instanceof HTMLElement && returnFocusTarget !== document.body
    ? returnFocusTarget
    : loginBtn
  networkModalTitle.textContent = title
  networkModalMessage.textContent = message
  networkModal.classList.add("open")
  networkModal.setAttribute("aria-hidden", "false")
  networkOkayBtn.focus()
}

function showNetworkModal(returnFocusTarget = document.activeElement) {
  showFeedbackModal(
    "Connection unavailable",
    "Please check your internet connection and try again.",
    returnFocusTarget
  )
}

function closeNetworkModal() {
  networkModal.classList.remove("open")
  networkModal.setAttribute("aria-hidden", "true")
  if (networkReturnFocus instanceof HTMLElement) networkReturnFocus.focus()
}

networkOkayBtn.addEventListener("click", closeNetworkModal)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && networkModal.classList.contains("open")) closeNetworkModal()
})

function setButtonLoading(isLoading) {
  loginBtn.disabled = isLoading
  loginBtn.classList.toggle("loading", isLoading)
  loginBtn.innerHTML = isLoading
    ? '<span class="spinner" aria-hidden="true"></span>Signing in...'
    : "Sign In"
}

function showPasswordLogin(shouldFocus = true) {
  loginMethodStatus.classList.add("hidden")
  passkeyLoginSection.classList.add("hidden")
  form.classList.remove("hidden")
  forgotPasswordLink.classList.remove("hidden")
  usePasskeyLoginBtn.classList.remove("hidden")
  if (shouldFocus) document.getElementById("phone").focus()
}

function showPasskeyLogin(shouldFocus = true) {
  loginMethodStatus.classList.add("hidden")
  form.classList.add("hidden")
  forgotPasswordLink.classList.add("hidden")
  passwordResetSection.classList.add("hidden")
  usePasskeyLoginBtn.classList.add("hidden")
  passkeyLoginSection.classList.remove("hidden")
  if (shouldFocus) passkeyLoginBtn.focus()
}

showPasswordLoginBtn.addEventListener("click", showPasswordLogin)
usePasskeyLoginBtn.addEventListener("click", showPasskeyLogin)

async function chooseLoginMethod() {
  if (!navigator.onLine || !(await window.PeskyPasskeys.isPlatformAvailable())) {
    showPasswordLogin(false)
    return
  }

  try {
    const hasPasskey = await window.PeskyPasskeys.hasPasskey(supabaseClient)
    if (hasPasskey) {
      showPasskeyLogin(false)
    } else {
      showPasswordLogin(false)
    }
  } catch (error) {
    console.warn("Unable to check passkey availability:", error)
    showPasswordLogin(false)
  }
}

chooseLoginMethod()

passkeyLoginBtn.addEventListener("click", async () => {
  passkeyLoginBtn.disabled = true
  passkeyLoginBtn.textContent = "Waiting for fingerprint..."
  try {
    if (!navigator.onLine) {
      showNetworkModal(passkeyLoginBtn)
      return
    }
    if (!(await window.PeskyPasskeys.isPlatformAvailable())) {
      showFeedbackModal("Fingerprint sign-in unavailable", "Use a supported device over a secure HTTPS connection, or choose password sign-in.", passkeyLoginBtn)
      return
    }

    await window.PeskyPasskeys.signIn(supabaseClient)
    passkeyLoginSection.classList.add("hidden")
    successMessage.classList.remove("hidden")
    window.location.href = "dashboard.html"
  } catch (error) {
    if (!navigator.onLine || /network|fetch/i.test(error.message || "")) {
      showNetworkModal(passkeyLoginBtn)
    } else {
      showFeedbackModal("Fingerprint sign-in unsuccessful", error.message || "Try again or use your password instead.", passkeyLoginBtn)
    }
  } finally {
    passkeyLoginBtn.disabled = false
    passkeyLoginBtn.textContent = "Sign in with fingerprint"
  }
})

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
    if (isNetworkError(error)) {
      showNetworkModal(resetEmailForm.querySelector('button[type="submit"]'))
    } else {
      showFeedbackModal("Unable to send code", "We could not send a code to that email. Check the address and try again.", resetEmailForm.querySelector('button[type="submit"]'))
    }
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
    if (isNetworkError(error)) {
      showNetworkModal(resetCodeForm.querySelector('button[type="submit"]'))
    } else {
      showFeedbackModal("Code not accepted", "That code is invalid or expired. Please request a new code.", resetCodeForm.querySelector('button[type="submit"]'))
    }
  } finally {
    setFormButtonLoading(resetCodeForm, false, "Verifying...", "Verify code")
  }
})

newPasswordForm.addEventListener("submit", async function(event) {
  event.preventDefault()
  const newPassword = document.getElementById("newPassword").value
  const confirmPassword = document.getElementById("confirmPassword").value

  if (newPassword.length < 6) {
    showFeedbackModal("Check your password", "Your new password must be at least 6 characters.", newPasswordForm.querySelector('button[type="submit"]'))
    return
  }

  if (newPassword !== confirmPassword) {
    showFeedbackModal("Passwords do not match", "Enter the same password in both fields.", newPasswordForm.querySelector('button[type="submit"]'))
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
    if (isNetworkError(error)) {
      showNetworkModal(newPasswordForm.querySelector('button[type="submit"]'))
    } else {
      showFeedbackModal("Unable to update password", error.message || "Please try again.", newPasswordForm.querySelector('button[type="submit"]'))
    }
  } finally {
    setFormButtonLoading(newPasswordForm, false, "Saving...", "Save new password")
  }
})

form.addEventListener("submit", async function(e) {
  e.preventDefault()

  if (!navigator.onLine) {
    showNetworkModal(e.submitter || loginBtn)
    return
  }

  const phone = normalizePhone(document.getElementById("phone").value.trim())
  const password = document.getElementById("password").value

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    showFeedbackModal("Check your phone number", "Enter a valid Nigerian phone number.", loginBtn)
    return
  }

  if (!password) {
    showFeedbackModal("Password required", "Enter your password to sign in.", loginBtn)
    return
  }

  setButtonLoading(true)

  try {
    const { data: lookup, error: lookupError } = await supabaseClient
      .rpc("get_login_email_by_phone", { phone_value: phone })

    if (lookupError) {
      if (isNetworkError(lookupError)) throw lookupError
      throw new Error("Phone number or password is incorrect.")
    }
    if (!lookup) throw new Error("Phone number or password is incorrect.")

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: lookup,
      password
    })

    if (error) {
      if (isNetworkError(error)) throw error
      throw new Error("Phone number or password is incorrect.")
    }
    if (!data?.user) {
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
    if (isNetworkError(err)) {
      showNetworkModal(loginBtn)
    } else {
      showFeedbackModal("Sign-in unsuccessful", err.message || "Unable to sign in. Please try again.", loginBtn)
    }
  } finally {
    setButtonLoading(false)
  }
})

