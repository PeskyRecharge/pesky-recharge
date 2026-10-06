//  Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById("createForm");
const createBtn = form.querySelector('button[type="submit"]');
const otpSection = document.getElementById("otpSection");
const verifyBtn = document.getElementById("verifyBtn");
const resendBtn = document.getElementById("resendBtn");
const successMessage = document.getElementById("successMessage");
const networkModal = document.getElementById("networkModal");
const networkModalTitle = document.getElementById("networkModalTitle");
const networkModalMessage = document.getElementById("networkModalMessage");
const networkOkayBtn = document.getElementById("networkOkayBtn");
const referralCodeInput = document.getElementById("referralCode");

let networkReturnFocus = null;
const referralCodeFromLink = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() || "";
if (/^[A-Z0-9]{7}$/.test(referralCodeFromLink)) {
  referralCodeInput.value = referralCodeFromLink;
}

function getReferralCode() {
  const value = referralCodeInput.value.trim().toUpperCase();
  return value && /^[A-Z0-9]{7}$/.test(value) ? value : null;
}

function isNetworkError(error) {
  return !navigator.onLine || /failed to fetch|network error|network request failed|load failed/i.test(error?.message || "");
}

function showFeedbackModal(title, message, returnFocusTarget = document.activeElement) {
  networkReturnFocus = returnFocusTarget instanceof HTMLElement && returnFocusTarget !== document.body
    ? returnFocusTarget
    : createBtn;
  networkModalTitle.textContent = title;
  networkModalMessage.textContent = message;
  networkModal.classList.add("open");
  networkModal.setAttribute("aria-hidden", "false");
  networkOkayBtn.focus();
}

function showNetworkModal(returnFocusTarget = document.activeElement) {
  showFeedbackModal(
    "Connection unavailable",
    "Please check your internet connection and try again.",
    returnFocusTarget
  );
}

function closeNetworkModal() {
  networkModal.classList.remove("open");
  networkModal.setAttribute("aria-hidden", "true");
  if (networkReturnFocus instanceof HTMLElement) networkReturnFocus.focus();
}

networkOkayBtn.addEventListener("click", closeNetworkModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && networkModal.classList.contains("open")) closeNetworkModal();
});

function setButtonLoading(button, text) {
  button.disabled = true;
  button.classList.add("loading");
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${text}`;
}

function resetButton(button, text) {
  button.disabled = false;
  button.classList.remove("loading");
  button.textContent = text;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
}

// Helper: generate unique user ID
function generateUserId() {
  return Math.random().toString(36).substring(2, 9).toUpperCase(); 
}

//  Step 1: Handle form submit → send OTP
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  console.log("Form submitted");

  if (!navigator.onLine) {
    showNetworkModal(e.submitter || createBtn);
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const enteredReferralCode = referralCodeInput.value.trim();
  const referralCode = getReferralCode();

  if (enteredReferralCode && !referralCode) {
    showFeedbackModal("Check referral code", "Enter a valid 7-character referral code, or leave the field blank to continue without one.", referralCodeInput);
    return;
  }

  if (password.length < 8) {
    showFeedbackModal("Check your password", "Your password must be at least 8 characters.", createBtn);
    return;
  }

  if (password !== confirmPassword) {
    showFeedbackModal("Passwords do not match", "Enter the same password in both fields.", createBtn);
    return;
  }

  setButtonLoading(createBtn, "Creating account...");

  try {
    // Ask Supabase Auth to send the OTP code.
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        data: referralCode ? { referral_code: referralCode } : {},
      }
    });

    if (error) {
      if (isNetworkError(error)) {
        showNetworkModal(createBtn);
      } else {
        showFeedbackModal("Unable to send code", error.message || "Please check your email address and try again.", createBtn);
      }
      return;
    }

    form.classList.add("hidden");
    otpSection.classList.remove("hidden");
  } catch (err) {
    console.error("Error creating account:", err);
    if (isNetworkError(err)) {
      showNetworkModal(createBtn);
    } else {
      showFeedbackModal("Unable to create account", "Please review your details and try again.", createBtn);
    }
  } finally {
    resetButton(createBtn, "Create Account");
  }
});

// Step 2: Verify OTP, then update the new user's details.
verifyBtn.addEventListener("click", async function () {
  const code = document.getElementById("code").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!navigator.onLine) {
    showNetworkModal(verifyBtn);
    return;
  }

  setButtonLoading(verifyBtn, "Verifying...");

  try {
    // Verify the OTP code.
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: email,
      token: code,
      type: "email"
    });

    if (error) {
      if (isNetworkError(error)) {
        showNetworkModal(verifyBtn);
      } else {
        showFeedbackModal("Code not accepted", error.message || "Check the verification code and try again.", verifyBtn);
      }
      return;
    }

    if (data?.user) {
      const user = data.user;
      const password = document.getElementById("password").value;

      const { error: passwordError } = await supabaseClient.auth.updateUser({
        password
      });

      if (passwordError) {
        if (isNetworkError(passwordError)) {
          showNetworkModal(verifyBtn);
        } else {
          showFeedbackModal("Unable to save password", passwordError.message, verifyBtn);
        }
        return;
      }

      // Collect extra fields
      const surname = document.getElementById("surname").value.trim();
      const othername = document.getElementById("othername").value.trim();
      const phone = normalizePhone(document.getElementById("phone").value.trim());
      const gender = document.getElementById("gender").value.trim();

      // Generate unique user ID
      const userId = generateUserId();

      //  Update customers row with extra details + user_id
      const { error: updateError } = await supabaseClient
        .from("customers")
        .update({
          surname: surname,
          other_name: othername,
          phone_number: phone,
          gender: gender,
          user_id: userId,
          referred_by: getReferralCode() || user.user_metadata?.referral_code || null,
        })
        .eq("auth_id", user.id);

      if (updateError) {
        console.error("Update error:", updateError.message);
        if (isNetworkError(updateError)) {
          showNetworkModal(verifyBtn);
        } else {
          showFeedbackModal("Unable to save details", updateError.message, verifyBtn);
        }
        return;
      }

      successMessage.classList.remove("hidden");
      otpSection.classList.add("hidden");

      window.location.href = "dashboard.html";
    } else {
      showFeedbackModal("Code not accepted", "That verification code is invalid. Please try again.", verifyBtn);
    }
  } catch (err) {
    console.error("Error verifying account:", err);
    if (isNetworkError(err)) {
      showNetworkModal(verifyBtn);
    } else {
      showFeedbackModal("Unable to verify account", "Please check the code and try again.", verifyBtn);
    }
  } finally {
    resetButton(verifyBtn, "Verify");
  }
});

resendBtn.addEventListener("click", async function () {
  const email = document.getElementById("email").value.trim();

  if (!email) {
    showFeedbackModal("Email required", "Enter your email address before requesting another code.", resendBtn);
    return;
  }

  if (!navigator.onLine) {
    showNetworkModal(resendBtn);
    return;
  }

  setButtonLoading(resendBtn, "Sending...");

  try {
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      if (isNetworkError(error)) {
        showNetworkModal(resendBtn);
      } else {
        showFeedbackModal("Unable to resend code", error.message || "Please wait a moment and try again.", resendBtn);
      }
      return;
    }

    showFeedbackModal("Code sent", `A new verification code was sent to ${email}.`, resendBtn);
  } catch (error) {
    console.error("Resend verification code error:", error);
    if (isNetworkError(error)) {
      showNetworkModal(resendBtn);
    } else {
      showFeedbackModal("Unable to resend code", error.message || "Please try again.", resendBtn);
    }
  } finally {
    resetButton(resendBtn, "Resend Code");
  }
});