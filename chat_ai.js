// chat_ai.js — Profile-based AI chat (DB powered)

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// get farmer profile from localStorage
function getFarmerId() {
  try {
    const farmer = JSON.parse(localStorage.getItem("farmer"));
    return farmer && farmer.id ? farmer.id : null;
  } catch {
    return null;
  }
}

// send message
async function sendMessage(message) {
  const farmerId = getFarmerId();

  // user bubble
  addMessage(message, "user");

  // typing animation
  const typingBubble = addTypingBubble();

  const res = await fetch("backend/ai_chat.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      farmer_id: farmerId
    })
  });

  const text = await response.text();
let data;

try {
  data = JSON.parse(text);
} catch (e) {
  console.error("Invalid JSON:", text);
  addMessage("⚠️ Server error. Check backend.", "bot");
  return;
}

  typingBubble.remove();

  addMessage(data.reply || "No response", "bot");
}

// UI helpers
function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = "chat-bubble " + type;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingBubble() {
  const div = document.createElement("div");
  div.className = "chat-bubble bot typing";
  div.textContent = "Typing...";
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// submit handler
chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = "";
  sendMessage(msg);
});
