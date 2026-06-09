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
const langWrapper = document.getElementById("lang-select-wrapper");
const joinBtn = document.getElementById("join-btn");
const roomLabel = document.getElementById("room-label");
const usersStatus = document.getElementById("users-status");
const joinTitle = document.getElementById("join-title");
const joinSub = document.getElementById("join-sub");

const lang = detectLangFromPath();
if (lang) {
  langSelect.value = lang;
  langWrapper.style.display = "none";
}

const translations = {
  en: {
    title: "Translator Chat",
    sub: "Vietnamese &harr; English",
    joinTitle: "Join Chat",
    namePlaceholder: "Your name",
    roomPlaceholder: "Room name",
    join: "Join Chat",
    inputPlaceholder: "Type a message...",
    users_one: "1 user online",
    users_two: "2 users online - Connected!",
    translating: "Translating...",
    error: "Error",
    networkError: "Network error. Is the server running?",
  },
  vi: {
    title: "Trò chuyện Dịch thuật",
    sub: "Tiếng Việt &harr; Tiếng Anh",
    joinTitle: "Tham gia Trò chuyện",
    namePlaceholder: "Tên của bạn",
    roomPlaceholder: "Tên phòng",
    join: "Tham gia",
    inputPlaceholder: "Nhập tin nhắn...",
    users_one: "1 người đang online",
    users_two: "2 người đang online - Đã kết nối!",
    translating: "Đang dịch...",
    error: "Lỗi",
    networkError: "Lỗi mạng. Máy chủ có đang chạy không?",
  },
};

function t(key) {
  return translations[userLang]?.[key] || translations["en"][key];
}

function detectLangFromPath() {
  const path = window.location.pathname;
  if (path.startsWith("/vi")) return "vi";
  if (path.startsWith("/en")) return "en";
  return null;
}

let userName = "";
let roomName = "default";
let userLang = "en";
let subscription = null;
let presenceChannel = null;

applyLangUI();

function applyLangUI() {
  const l = langSelect.value;
  joinTitle.textContent = translations[l].joinTitle;
  nameInput.placeholder = translations[l].namePlaceholder;
  roomInput.placeholder = translations[l].roomPlaceholder;
  joinBtn.textContent = translations[l].join;
  input.placeholder = translations[l].inputPlaceholder;
}

langSelect.addEventListener("change", applyLangUI);

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const room = roomInput.value.trim() || "default";
  if (!name) return;

  userName = name;
  roomName = room;
  userLang = langSelect.value;

  joinScreen.style.display = "none";
  chatScreen.style.display = "flex";
  roomLabel.textContent = t("title") + " | Room: " + room;

  loadMessages();
  subscribeToRoom();
  trackPresence();
});

async function loadMessages() {
  const res = await fetch("/api/messages?room=" + encodeURIComponent(roomName));
  const messages = await res.json();
  chat.innerHTML = "";
  messages.forEach((msg) => renderMessage(msg));
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
        renderMessage(payload.new);
      }
    )
    .subscribe();
}

function trackPresence() {
  presenceChannel = supabase.channel("room-" + roomName, {
    config: { presence: { key: userName } },
  });

  presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const users = Object.keys(state);
      if (users.length === 1) {
        usersStatus.innerHTML = '<span class="online">' + t("users_one") + "</span>";
      } else {
        usersStatus.innerHTML =
          '<span class="online">' +
          users.join(" & ") +
          " &mdash; " +
          t("users_two") +
          "</span>";
      }
    })
    .on("presence", { event: "join" }, ({ key }) => {
      const msg = document.createElement("div");
      msg.className = "message other";
      msg.style.fontSize = "12px";
      msg.style.opacity = "0.7";
      msg.style.textAlign = "center";
      msg.style.maxWidth = "100%";
      msg.textContent = key + " joined";
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      const msg = document.createElement("div");
      msg.className = "message other";
      msg.style.fontSize = "12px";
      msg.style.opacity = "0.7";
      msg.style.textAlign = "center";
      msg.style.maxWidth = "100%";
      msg.textContent = key + " left";
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ online_at: new Date().toISOString() });
      }
    });
}

function renderMessage(msg) {
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
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  input.value = "";

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message me";
  loadingDiv.style.opacity = "0.6";
  loadingDiv.textContent = t("translating");
  chat.appendChild(loadingDiv);
  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, room: roomName, user_name: userName }),
    });

    loadingDiv.remove();

    if (!res.ok) {
      const data = await res.json();
      const errDiv = document.createElement("div");
      errDiv.className = "message me";
      errDiv.innerHTML =
        '<div class="sender">' + userName + "</div><div>" + (data.error || t("error")) + "</div>";
      chat.appendChild(errDiv);
      chat.scrollTop = chat.scrollHeight;
    }
  } catch {
    loadingDiv.remove();
    const errDiv = document.createElement("div");
    errDiv.className = "message me";
    errDiv.innerHTML =
      '<div class="sender">' + userName + "</div><div>" + t("networkError") + "</div>";
    chat.appendChild(errDiv);
    chat.scrollTop = chat.scrollHeight;
  }
});
