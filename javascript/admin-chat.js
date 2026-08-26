// Supabase setup
const supabaseUrl = "https://beyykzogvaemjvecbzkf.supabase.co";
const supabaseKey = "sb_publishable_JDxS16gwlyg9SxF0T2owYg_KKZqE9Gy";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const userList = document.getElementById("userList");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatWith = document.getElementById("chatWith");

let selectedUserId = null;
let userElements = {}; // store li elements by user_id

// Load users who have chatted
async function loadUsers() {
  const { data: chatUsers, error } = await supabaseClient
    .from("chats")
    .select("user_id")
    .neq("sender", "admin");

  if (error) {
    console.error("Load chat users error:", error);
    return;
  }

  const uniqueIds = [...new Set(chatUsers.map(c => c.user_id))];

  if (uniqueIds.length === 0) {
    userList.innerHTML = "<li>No chat users yet</li>";
    return;
  }

  const { data: customers, error: custError } = await supabaseClient
    .from("customers")
    .select("auth_id, email")
    .in("auth_id", uniqueIds);

  if (custError) {
    console.error("Load customers error:", custError);
    return;
  }

  // Render list
  userList.innerHTML = "";
  customers.forEach(user => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";

    // Email label
    const emailSpan = document.createElement("span");
    emailSpan.textContent = user.email;
    emailSpan.style.cursor = "pointer";
    emailSpan.addEventListener("click", () => {
      selectedUserId = user.auth_id;
      chatWith.textContent = `Chat with ${user.email}`;
      loadMessages();

      // Clear badge when opening chat
      const badge = li.querySelector(".badge");
      if (badge) badge.remove();
    });

    // Delete button (clears admin messages only)
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.style.marginLeft = "10px";
    delBtn.style.background = "red";
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.padding = "4px 8px";
    delBtn.style.cursor = "pointer";
    delBtn.style.borderRadius = "4px";

    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`Clear your messages with ${user.email}?`);
      if (!confirmDelete) return;

      const { error } = await supabaseClient
        .from("chats")
        .delete()
        .eq("user_id", user.auth_id)
        .eq("sender", "admin");

      if (error) {
        console.error("Delete admin messages error:", error);
        alert("Failed to clear your messages.");
        return;
      }

      li.remove();
      if (selectedUserId === user.auth_id) {
        selectedUserId = null;
        chatWith.textContent = "No user selected";
        chatMessages.innerHTML = "";
      }
    });

    li.appendChild(emailSpan);
    li.appendChild(delBtn);
    userList.appendChild(li);

    // Save reference
    userElements[user.auth_id] = li;
  });
}

// Load messages for selected user
async function loadMessages() {
  if (!selectedUserId) return;

  const { data, error } = await supabaseClient
    .from("chats")
    .select("sender, message, created_at")
    .eq("user_id", selectedUserId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load chat error:", error);
    return;
  }

  chatMessages.innerHTML = "";
  data.forEach(msg => renderMessage(msg));
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render message with timestamp
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message", msg.sender);

  const time = new Date(msg.created_at).toLocaleTimeString();
  div.innerHTML = `<p>${msg.message}</p><small>${time}</small>`;

  chatMessages.appendChild(div);
}

// Send reply
sendBtn.addEventListener("click", async () => {
  if (!selectedUserId) return;
  const text = chatInput.value.trim();
  if (!text) return;

  const tempMsg = { sender: "admin", message: text, created_at: new Date().toISOString() };
  renderMessage(tempMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.value = "";

  const { error } = await supabaseClient
    .from("chats")
    .insert([{ user_id: selectedUserId, sender: "admin", message: text }]);

  if (error) {
    console.error("Send error:", error);
  }
});

// Global subscription to all new messages
supabaseClient
  .channel("admin-chat")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chats" },
    payload => {
      const msg = payload.new;

      // Update user list if new user appears
      loadUsers();

      // If currently chatting with this user, show instantly
      if (selectedUserId && msg.user_id === selectedUserId) {
        renderMessage(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        // Add "New message" badge beside user email
        const li = userElements[msg.user_id];
        if (li && msg.sender === "user") {
          if (!li.querySelector(".badge")) {
            const badge = document.createElement("span");
            badge.textContent = "New message";
            badge.className = "badge";
            badge.style.background = "#0078d7";
            badge.style.color = "white";
            badge.style.padding = "2px 6px";
            badge.style.borderRadius = "4px";
            badge.style.marginLeft = "10px";
            li.appendChild(badge);
          }
        }
      }
    }
  )
  .subscribe();

// Initialize
loadUsers();
