// ============================================
// SUPABASE CONFIG
// ============================================

const supabaseUrl =
  "https://beyykzogvaemjvecbzkf.supabase.co";

const supabaseKey =
  "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";

const supabaseClient = supabase.createClient(
  supabaseUrl,
  supabaseKey
);

// ============================================
// DOM ELEMENTS
// ============================================

const titleInput =
  document.getElementById("title");

const messageInput =
  document.getElementById("message");

const sendBtn =
  document.getElementById("sendBtn");

const statusText =
  document.getElementById("status");

// ============================================
// SEND NOTIFICATION
// ============================================

async function sendNotification() {

  const title =
    titleInput.value.trim();

  const message =
    messageInput.value.trim();

  if (!title) {
    alert("Enter notification title");
    return;
  }

  if (!message) {
    alert("Enter notification message");
    return;
  }

  sendBtn.disabled = true;

  statusText.style.color = "#fff";
  statusText.textContent =
    "Sending notification...";

  try {

    const { data, error } =
      await supabaseClient
        .from("notifications")
        .insert([
          {
            title: title,
            message: message
          }
        ]);

    if (error) {
      console.error(
        "Notification Error:",
        error
      );

      statusText.style.color =
        "red";

      statusText.textContent =
        error.message;

      sendBtn.disabled = false;
      return;
    }

    titleInput.value = "";
    messageInput.value = "";

    statusText.style.color =
      "lightgreen";

    statusText.textContent =
      "Notification sent successfully.";

    sendBtn.disabled = false;

    console.log(
      "Notification sent",
      data
    );

  } catch (err) {

    console.error(
      "Unexpected Error:",
      err
    );

    statusText.style.color =
      "red";

    statusText.textContent =
      "Unexpected error occurred.";

    sendBtn.disabled = false;
  }
}

// ============================================
// EVENT LISTENER
// ============================================

sendBtn.addEventListener(
  "click",
  sendNotification
);