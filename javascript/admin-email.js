// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM references
const subjectInput = document.getElementById("emailSubject");
const messageInput = document.getElementById("emailMessage");
const sendEmailBtn = document.getElementById("sendEmailBtn");
const emailStatus = document.getElementById("emailStatus");

function setStatus(text, isError = false) {
  emailStatus.textContent = text;
  emailStatus.style.color = isError ? "red" : "green";
}

sendEmailBtn.addEventListener("click", async () => {
  const subject = subjectInput.value.trim();
  const message = messageInput.value.trim();

  if (!subject || !message) {
    setStatus("Enter a subject and message.", true);
    return;
  }

  if (!confirm("Send this email to every registered user?")) return;

  sendEmailBtn.disabled = true;
  setStatus("Sending...");

  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw new Error("Failed to read your admin session.");

    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Admin session expired. Please log in again.");

    const { data: result, error: invokeError } = await supabaseClient.functions.invoke("send-broadcast-email", {
      body: { subject, message },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (invokeError) {
      console.error("Edge function error:", invokeError);
      const detail = invokeError.message || "The email broadcast failed.";
      throw new Error(detail.includes("404") ? "The email broadcast function is not deployed in Supabase yet." : detail);
    }

    if (!result || typeof result.sent !== "number" || typeof result.total !== "number") {
      throw new Error("The email function returned an invalid response.");
    }

    subjectInput.value = "";
    messageInput.value = "";

    let statusMsg = `Email sent to ${result.sent} of ${result.total} users.`;
    if (result.failed) statusMsg += ` ${result.failed} failed.`;

    setStatus(statusMsg);
  } catch (error) {
    console.error("Broadcast email failed:", error);
    setStatus(error.message || "The email broadcast failed.", true);
  } finally {
    sendEmailBtn.disabled = false;
  }
});
