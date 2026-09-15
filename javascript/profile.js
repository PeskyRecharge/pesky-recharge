const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const statusMessage = document.getElementById("statusMessage");
let currentUser;
let customer;
let passwordEmailVerified = false;
const buttonLabels = new Map();

function setButtonLoading(button, loadingText) {
  if (button.disabled) return;
  buttonLabels.set(button, button.innerHTML);
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${loadingText}`;
}

function resetButton(button) {
  button.disabled = false;
  button.classList.remove("is-loading");
  button.innerHTML = buttonLabels.get(button) || button.innerHTML;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function displayValue(value, fallback = "Not provided") {
  return value || fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function getSavedAvatar() {
  return currentUser.user_metadata?.avatar_data || localStorage.getItem(`pesky-avatar-${currentUser.id}`);
}

function renderProfile() {
  const fullName = `${displayValue(customer.surname, "")} ${displayValue(customer.other_name, "")}`.trim() || "Your profile";
  document.getElementById("profileHeading").textContent = fullName;
  document.getElementById("profileEmail").textContent = displayValue(customer.email, currentUser.email);
  const initials = fullName.split(" ").filter(Boolean).slice(0, 2).map(name => name[0]).join("").toUpperCase() || "?";
  const savedAvatar = getSavedAvatar();
  document.getElementById("avatarPreview").innerHTML = savedAvatar ? `<img src="${escapeHtml(savedAvatar)}" alt="${escapeHtml(fullName)} profile picture">` : escapeHtml(initials);
  document.getElementById("detailsList").innerHTML = `
    <div><dt>Surname</dt><dd>${escapeHtml(displayValue(customer.surname))}</dd></div>
    <div><dt>Other name</dt><dd>${escapeHtml(displayValue(customer.other_name))}</dd></div>
    <div><dt>Email</dt><dd>${escapeHtml(displayValue(customer.email, currentUser.email))}</dd></div>
    <div><dt>Phone number</dt><dd>${escapeHtml(displayValue(customer.phone_number))}</dd></div>
    <div><dt>Date joined</dt><dd>${new Date(customer.created_at || currentUser.created_at).toLocaleDateString()}</dd></div>`;
  document.getElementById("surnameInput").value = customer.surname || "";
  document.getElementById("otherNameInput").value = customer.other_name || "";
  document.getElementById("phoneInput").value = customer.phone_number || "";
}

async function loadProfile() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) { window.location.href = "login.html"; return; }
  currentUser = userData.user;
  const { data, error } = await supabaseClient.from("customers").select("surname, other_name, email, phone_number, created_at").eq("auth_id", currentUser.id).single();
  if (error) { setStatus("We could not load your profile details.", true); return; }
  customer = data;
  renderProfile();
  document.getElementById("notificationToggle").checked = notificationsEnabled(currentUser.id, "activity");
  document.getElementById("loginNotificationToggle").checked = notificationsEnabled(currentUser.id, "login");
  document.getElementById("currentEmailInput").value = customer.email || currentUser.email || "";
  document.getElementById("passwordEmailInput").value = customer.email || currentUser.email || "";
  document.getElementById("loginActivity").textContent = `Current session active since ${new Date(currentUser.last_sign_in_at || Date.now()).toLocaleString()}.`;
  checkMfa();
}

document.getElementById("editProfileBtn").addEventListener("click", () => { document.getElementById("profileForm").hidden = false; document.getElementById("detailsList").hidden = true; });
document.getElementById("cancelEditBtn").addEventListener("click", () => { document.getElementById("profileForm").hidden = true; document.getElementById("detailsList").hidden = false; });
document.getElementById("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = event.submitter;
  setButtonLoading(saveButton, "Saving...");
  const updates = { surname: document.getElementById("surnameInput").value.trim(), other_name: document.getElementById("otherNameInput").value.trim(), phone_number: document.getElementById("phoneInput").value.trim() };
  const { error } = await supabaseClient.from("customers").update(updates).eq("auth_id", currentUser.id);
  if (error) { setStatus("Unable to save your details right now.", true); resetButton(saveButton); return; }
  customer = { ...customer, ...updates }; renderProfile(); document.getElementById("profileForm").hidden = true; document.getElementById("detailsList").hidden = false; setStatus("Profile updated successfully.");
  resetButton(saveButton);
});

document.getElementById("sendCurrentCodeBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  setButtonLoading(button, "Sending...");
  const currentEmail = document.getElementById("currentEmailInput").value.trim();
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: currentEmail,
    options: { shouldCreateUser: false }
  });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  document.getElementById("currentCodeStep").hidden = false;
  button.hidden = true;
  setStatus("A verification code was sent to your current email.");
  button.disabled = false;
  button.classList.remove("is-loading");
});

document.getElementById("verifyCurrentCodeBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const code = document.getElementById("currentCodeInput").value.trim();
  if (!code) { setStatus("Enter the code sent to your current email.", true); return; }
  setButtonLoading(button, "Verifying...");
  const { error } = await supabaseClient.auth.verifyOtp({ email: document.getElementById("currentEmailInput").value, token: code, type: "email" });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  document.getElementById("newEmailStep").hidden = false;
  document.getElementById("currentEmailStep").hidden = true;
  setStatus("Current email verified. Enter your new email address.");
  resetButton(button);
});

document.getElementById("emailForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("sendNewEmailBtn");
  const email = document.getElementById("emailInput").value.trim();
  if (email.toLowerCase() === document.getElementById("currentEmailInput").value.trim().toLowerCase()) { setStatus("Enter an email address different from your current email.", true); return; }
  setButtonLoading(button, "Sending...");
  const { error } = await supabaseClient.auth.updateUser({ email });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  document.getElementById("newCodeStep").hidden = false;
  button.hidden = true;
  setStatus("A verification code was sent to your new email.");
  button.disabled = false;
  button.classList.remove("is-loading");
});

document.getElementById("verifyNewEmailBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const newEmail = document.getElementById("emailInput").value.trim();
  const code = document.getElementById("newCodeInput").value.trim();
  if (!code) { setStatus("Enter the code sent to your new email.", true); return; }
  setButtonLoading(button, "Checking...");
  const { data, error } = await supabaseClient.auth.verifyOtp({ email: newEmail, token: code, type: "email_change" });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  const verifiedUser = data.user || (await supabaseClient.auth.getUser()).data.user;
  const { error: customerError } = await supabaseClient.from("customers").update({ email: verifiedUser.email }).eq("auth_id", currentUser.id);
  if (customerError) { setStatus("Email verified, but your profile record could not be refreshed.", true); resetButton(button); return; }
  currentUser = verifiedUser;
  customer.email = verifiedUser.email;
  renderProfile();
  document.getElementById("currentEmailInput").value = verifiedUser.email;
  document.getElementById("newEmailStep").hidden = true;
  document.getElementById("currentEmailStep").hidden = false;
  setStatus("Your email address has been changed successfully.");
  resetButton(button);
});

document.getElementById("sendPasswordCodeBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const email = document.getElementById("passwordEmailInput").value.trim();
  if (!email) { setStatus("Your account email is not available. Please refresh and try again.", true); return; }
  setButtonLoading(button, "Sending...");
  const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  document.getElementById("passwordCodeStep").hidden = false;
  button.hidden = true;
  setStatus("A verification code was sent to your account email.");
  button.disabled = false;
  button.classList.remove("is-loading");
});

document.getElementById("verifyPasswordCodeBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const email = document.getElementById("passwordEmailInput").value.trim();
  const code = document.getElementById("passwordCodeInput").value.trim();
  if (!code) { setStatus("Enter the code sent to your account email.", true); return; }
  setButtonLoading(button, "Verifying...");
  const { data, error } = await supabaseClient.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  if (!data?.user || data.user.id !== currentUser.id) { setStatus("That code did not verify this account. Please try again.", true); resetButton(button); return; }
  passwordEmailVerified = true;
  document.getElementById("passwordCodeStep").hidden = true;
  document.getElementById("passwordVerificationStep").hidden = true;
  document.getElementById("passwordForm").hidden = false;
  setStatus("Email verified. You can now choose a new password.");
  resetButton(button);
});

document.getElementById("passwordForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!passwordEmailVerified) { setStatus("Verify your email before changing your password.", true); return; }
  const password = document.getElementById("newPasswordInput").value;
  const confirmation = document.getElementById("confirmPasswordInput").value;
  const button = event.submitter;
  if (password.length < 8) { setStatus("Your new password must be at least 8 characters.", true); return; }
  if (password !== confirmation) { setStatus("The passwords do not match.", true); return; }
  setButtonLoading(button, "Updating...");
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  passwordEmailVerified = false;
  document.getElementById("passwordForm").reset();
  document.getElementById("passwordForm").hidden = true;
  document.getElementById("passwordVerificationStep").hidden = false;
  document.getElementById("passwordCodeStep").hidden = true;
  document.getElementById("sendPasswordCodeBtn").hidden = false;
  setStatus("Your password has been changed successfully.");
  resetButton(button);
});

document.getElementById("avatarInput").addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { data, error } = await supabaseClient.auth.updateUser({ data: { avatar_data: reader.result } });
    if (error) { setStatus("Unable to save your profile picture. Please try again.", true); return; }
    currentUser = data.user;
    localStorage.setItem(`pesky-avatar-${currentUser.id}`, reader.result);
    renderProfile();
    setStatus("Profile picture updated successfully.");
  };
  reader.readAsDataURL(file);
});

async function checkMfa() {
  if (!supabaseClient.auth.mfa) { document.getElementById("mfaStatus").textContent = "Multi-factor authentication is not enabled for this project."; return; }
  const { data, error } = await supabaseClient.auth.mfa.listFactors();
  if (error) { document.getElementById("mfaStatus").textContent = "MFA availability could not be checked."; return; }
  const enabled = data.all?.some(factor => factor.status === "verified");
  document.getElementById("mfaStatus").textContent = enabled ? "Your account has a verified second factor." : "Add an authenticator app for an extra layer of protection.";
  document.getElementById("mfaBtn").textContent = enabled ? "Manage 2FA" : "Set up 2FA";
}

let pendingMfaFactor;

document.getElementById("mfaBtn").addEventListener("click", () => {
  if (!supabaseClient.auth.mfa) { setStatus("MFA is not available in this Supabase project.", true); return; }
  document.getElementById("mfaSetup").hidden = false;
  document.getElementById("mfaBtn").hidden = true;
});

document.getElementById("cancelMfaBtn").addEventListener("click", () => {
  document.getElementById("mfaSetup").hidden = true;
  document.getElementById("mfaBtn").hidden = false;
});

document.getElementById("totpMethodBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  setButtonLoading(button, "Preparing...");
  const { data, error } = await supabaseClient.auth.mfa.enroll({ factorType: "totp", friendlyName: "Pesky Recharge authenticator" });
  if (error) { setStatus(error.message, true); resetButton(button); return; }
  if (!data?.totp?.qr_code) {
    setStatus("Supabase did not return a QR code. Check that TOTP MFA is enabled in your Supabase project.", true);
    resetButton(button);
    return;
  }
  pendingMfaFactor = data;
  const qrCode = data.totp.qr_code;
  document.getElementById("mfaQr").src = qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  document.getElementById("mfaQr").onerror = () => setStatus("The QR code could not be displayed. Try setting up 2FA again.", true);
  document.getElementById("totpSetup").hidden = false;
  setStatus("Scan the QR code, then enter the code from your authenticator app.");
  resetButton(button);
});

document.getElementById("verifyTotpBtn").addEventListener("click", async event => {
  const button = event.currentTarget;
  const code = document.getElementById("totpCodeInput").value.trim();
  if (!pendingMfaFactor || !code) { setStatus("Enter the code from your authenticator app.", true); return; }
  setButtonLoading(button, "Verifying...");
  const challenge = await supabaseClient.auth.mfa.challenge({ factorId: pendingMfaFactor.id });
  const verification = challenge.error ? challenge : await supabaseClient.auth.mfa.verify({ factorId: pendingMfaFactor.id, challengeId: challenge.data.id, code });
  if (verification.error) { setStatus(verification.error.message, true); resetButton(button); return; }
  setStatus("Two-factor authentication is now active.");
  document.getElementById("mfaSetup").hidden = true;
  document.getElementById("mfaBtn").hidden = false;
  pendingMfaFactor = null;
  checkMfa(); resetButton(button);
});

async function requestNotifications(toggle) {
  if (!("Notification" in window)) { toggle.checked = false; setStatus("This browser does not support notifications.", true); return; }
  const type = toggle.id === "loginNotificationToggle" ? "login" : "activity";
  if (!toggle.checked) { setNotificationsEnabled(currentUser.id, type, false); setStatus("Notifications disabled on this device."); return; }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") { toggle.checked = false; setNotificationsEnabled(currentUser.id, type, false); setStatus("Notification permission was not granted.", true); return; }
  setNotificationsEnabled(currentUser.id, type, true); setStatus("Notifications enabled on this device.");
}
document.getElementById("notificationToggle").addEventListener("change", event => requestNotifications(event.target));
document.getElementById("loginNotificationToggle").addEventListener("change", event => requestNotifications(event.target));
document.getElementById("signOutBtn").addEventListener("click", async event => { const button = event.currentTarget; setButtonLoading(button, "Signing out..."); const { error } = await supabaseClient.auth.signOut({ scope: "global" }); if (error) { setStatus(error.message, true); resetButton(button); return; } window.location.href = "index.html"; });
loadProfile();