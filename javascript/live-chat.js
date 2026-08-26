// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

let currentUser = null;

async function getUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) {
    alert("You must be logged in to chat.");
    return;
  }
  currentUser = data.user;
  loadMessages();
  subscribeToMessages();
}

async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("chats")
    .select("sender, message, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  chatMessages.innerHTML = "";
  data.forEach(msg => renderMessage(msg));
}

function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message", msg.sender);
  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : "";
  div.innerHTML = `<p>${msg.message}</p><small>${time}</small>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  // Show immediately
  renderMessage({ sender: "user", message: text, created_at: new Date().toISOString() });
  chatInput.value = "";

  // Insert into Supabase
  const { error } = await supabaseClient
    .from("chats")
    .insert([{ user_id: currentUser.id, sender: "user", message: text }]);

  if (error) console.error(error);
});

// ✅ Subscribe to ALL new messages for this user
function subscribeToMessages() {
  supabaseClient
    .channel("chat-room")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chats", filter: `user_id=eq.${currentUser.id}` },
      payload => {
        // Show any new message (admin or user)
        renderMessage(payload.new);
      }
    )
    .subscribe();
}

getUser();
