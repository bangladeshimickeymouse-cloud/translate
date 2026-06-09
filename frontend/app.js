const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = role === "user" ? "You" : "Translation";

  const content = document.createElement("div");
  content.textContent = text;

  div.appendChild(label);
  div.appendChild(content);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message bot";
  loadingDiv.textContent = "Translating...";
  chat.appendChild(loadingDiv);

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    loadingDiv.remove();

    if (res.ok) {
      addMessage(data.translated, "bot");
    } else {
      addMessage(data.error || "An error occurred", "bot");
    }
  } catch {
    loadingDiv.remove();
    addMessage("Network error. Is the server running?", "bot");
  }
});
