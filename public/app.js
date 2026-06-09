import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fmkjzajotdphoozprozo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_N89qXz3v9nNgjANgfloJrQ_GaCoK9Ls";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const nameInput = document.getElementById("name-input");
const roomInput = document.getElementById("room-input");
const langSelect = document.getElementById("lang-select");
const joinBtn = document.getElementById("join-btn");
const roomLabel = document.getElementById("room-label");

let userName = "";
let roomName = "default";
let userLang = "en";
let subscription = null;

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const room = roomInput.value.trim() || "default";
  if (!name) return;

  userName = name;
  roomName = room;
  userLang = langSelect.value;

  joinScreen.style.display = "none";
  chatScreen.style.display = "flex";
  roomLabel.textContent = "Room: " + room;

  loadMessages();
  subscribeToRoom();
});

async function loadMessages() {
  const res = await fetch("/api/messages?room=" + encodeURIComponent(roomName));
  const messages = await res.json();
  chat.innerHTML = "";
  messages.forEach((msg) => renderMessage(msg, false));
  chat.scrollTop = chat.scrollHeight;
}

function subscribeToRoom() {
  if (subscription) subscription.unsubscribe();

  subscription = supabase
    .channel("messages-" + roomName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: "room=eq." + roomName,
      },
      (payload) => {
        renderMessage(payload.new, true);
      }
    )
    .subscribe();
}

function renderMessage(msg, isNew) {
  const div = document.createElement("div");
  const isMe = msg.user_name === userName;
  div.className = "message " + (isMe ? "me" : "other");

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = msg.user_name;

  const content = document.createElement("div");
  content.textContent = isMe ? msg.original_text : msg.translated_text;

  div.appendChild(sender);
  div.appendChild(content);

  if (isNew) {
    chat.appendChild(div);
  } else {
    chat.appendChild(div);
  }

  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  input.value = "";

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message me";
  loadingDiv.innerHTML = '<div class="sender">' + userName + '</div><div>Translating...</div>';
  chat.appendChild(loadingDiv);
  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, room: roomName, user_name: userName }),
    });

    const data = await res.json();
    loadingDiv.remove();

    if (!res.ok) {
      const errDiv = document.createElement("div");
      errDiv.className = "message me";
      errDiv.innerHTML = '<div class="sender">' + userName + '</div><div>' + (data.error || "Error") + '</div>';
      chat.appendChild(errDiv);
      chat.scrollTop = chat.scrollHeight;
    }
  } catch {
    loadingDiv.remove();
    const errDiv = document.createElement("div");
    errDiv.className = "message me";
    errDiv.innerHTML = '<div class="sender">' + userName + '</div><div>Network error. Is the server running?</div>';
    chat.appendChild(errDiv);
    chat.scrollTop = chat.scrollHeight;
  }
});
