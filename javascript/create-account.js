//  Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.getElementById("createForm");
const createBtn = form.querySelector('button[type="submit"]');
const otpSection = document.getElementById("otpSection");
const verifyBtn = document.getElementById("verifyBtn");
const successMessage = document.getElementById("successMessage");

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

//  Step 1: Handle form submit → send OTP
form.addEventListener("submit", async function (e) {
  e.preventDefault();
  console.log("Form submitted");

  const email = document.getElementById("email").value.trim();
  setButtonLoading(createBtn, "Creating account...");

  try {
    // Ask Supabase Auth to send the OTP code.
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: true }
    });

    if (error) {
      alert("Error sending OTP: " + error.message);
      return;
    }

    form.classList.add("hidden");
    otpSection.classList.remove("hidden");
  } catch (err) {
    console.error("Error creating account:", err);
    alert("Unable to create account. Please try again.");
  } finally {
    resetButton(createBtn, "Create Account");
  }
});

//  Step 2: Verify OTP → trigger inserts row, then update details
verifyBtn.addEventListener("click", async function () {
  const code = document.getElementById("code").value.trim();
  const email = document.getElementById("email").value.trim();
  setButtonLoading(verifyBtn, "Verifying...");

  try {
    // Verify the OTP code.
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: email,
      token: code,
      type: "email"
    });

    if (error) {
      alert("Error verifying: " + error.message);
      return;
    }

    if (data?.user) {
      const user = data.user;

    // Collect extra fields
    const surname = document.getElementById("surname").value.trim();
    const othername = document.getElementById("othername").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const gender = document.getElementById("gender").value.trim();

    //  Update customers row with extra details
    const { error: updateError } = await supabaseClient
      .from("customers")
      .update({
        surname: surname,
        other_name: othername,
        phone_number: phone,
        gender: gender
      })
      .eq("auth_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError.message);
      alert("Error saving customer details: " + updateError.message);
      return;
    }

    successMessage.classList.remove("hidden");
    otpSection.classList.add("hidden");

      window.location.href = "dashboard.html";
    } else {
      alert("Invalid code. Please try again.");
    }
  } catch (err) {
    console.error("Error verifying account:", err);
    alert("Unable to verify account. Please try again.");
  } finally {
    resetButton(verifyBtn, "Verify");
  }
});
