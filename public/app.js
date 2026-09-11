const $ = s => document.querySelector(s);
const messagesEl = $("#messages");
const welcome = $("#welcome");
const chatListEl = $("#chatList");
const prompt = $("#prompt");
const form = $("#chatForm");
const sendBtn = $("#sendBtn");

let chats = JSON.parse(localStorage.getItem("myai_chats") || "[]");
let currentId = localStorage.getItem("myai_current") || null;
let controller = null;

function save() {
  localStorage.setItem("myai_chats", JSON.stringify(chats));
  if (currentId) localStorage.setItem("myai_current", currentId);
}

function newChat() {
  const chat = { id: crypto.randomUUID(), title: "New chat", messages: [], updated: Date.now() };
  chats.unshift(chat); currentId = chat.id; save(); renderAll(); prompt.focus(); closeSidebar();
}

function currentChat() { return chats.find(c => c.id === currentId); }

function renderChatList(filter="") {
  chatListEl.innerHTML = "";
  chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase())).forEach(chat => {
    const row = document.createElement("div");
    row.className = "chat-item" + (chat.id === currentId ? " active" : "");
    row.innerHTML = `<span class="title"></span><button class="delete" title="Delete">×</button>`;
    row.querySelector(".title").textContent = chat.title;
    row.querySelector(".title").onclick = () => { currentId = chat.id; save(); renderAll(); closeSidebar(); };
    row.querySelector(".delete").onclick = e => { e.stopPropagation(); deleteChat(chat.id); };
    chatListEl.appendChild(row);
  });
}

function deleteChat(id) {
  chats = chats.filter(c => c.id !== id);
  if (currentId === id) currentId = chats[0]?.id || null;
  if (!currentId) newChat(); else { save(); renderAll(); }
}

function renderMessages() {
  const chat = currentChat();
  messagesEl.innerHTML = "";

  if (!chat || chat.messages.length === 0) {
    welcome.style.display = "block";
    return;
  }

  welcome.style.display = "none";

  chat.messages.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "msg " + m.role;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = m.role === "user" ? "Y" : "✦";

    const body = document.createElement("div");
    body.className = "msg-content";

    body.innerHTML = marked.parse(m.content);

    if (m.content.includes("```")) {
      body.querySelectorAll("pre code").forEach(code => {
        const button = document.createElement("button");
        button.className = "copy-code";
        button.textContent = "Copy code";

        button.onclick = async () => {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = "Copied!";
          setTimeout(() => button.textContent = "Copy code", 1500);
        };

        code.parentElement.appendChild(button);
      });
    }

    row.append(avatar, body);

    if (m.role === "assistant") {
      const tools = document.createElement("div");
      tools.className = "msg-tools";
      tools.innerHTML =
        `<button data-copy>Copy</button>` +
        `${i === chat.messages.length - 1
          ? '<button data-regenerate>Regenerate</button>'
          : ''}`;

      body.appendChild(tools);

      tools.querySelector("[data-copy]").onclick =
        () => navigator.clipboard.writeText(m.content);

      const regen = tools.querySelector("[data-regenerate]");
      if (regen) regen.onclick = regenerate;
    }

    messagesEl.appendChild(row);
  });

  requestAnimationFrame(() => {
    const c = $("#conversation");
    c.scrollTop = c.scrollHeight;
  });
}
function renderAll() {
  renderChatList();
  renderMessages();
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#backdrop").classList.remove("show");
}

function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#backdrop").classList.add("show");
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  sendBtn.textContent = loading ? "…" : "↑";
}

async function sendMessage(text) {
  text = String(text || "").trim();
  if (!text) return;

  if (!currentId) {
    newChat();
  }

  const chat = currentChat();
  if (!chat) return;

  chat.messages.push({
    role: "user",
    content: text
  });

  if (chat.title === "New chat") {
    chat.title = text.slice(0, 40) + (text.length > 40 ? "…" : "");
  }

  chat.updated = Date.now();
  save();
  renderAll();

  setLoading(true);

  const mathEnabled = $("#mathMode").classList.contains("active");
  const topic = $("#mathTopic").value;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chat.messages,
        mathMode: mathEnabled,
        mathTopic: topic
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The AI request failed.");
    }

    chat.messages.push({
      role: "assistant",
      content: data.reply || "I couldn't generate a response."
    });

    chat.updated = Date.now();
    save();
    renderAll();

  } catch (error) {
    console.error(error);

    chat.messages.push({
      role: "assistant",
      content: "Sorry, something went wrong. Please try again."
    });

    save();
    renderAll();

  } finally {
    setLoading(false);
    prompt.focus();
  }
}

async function regenerate() {
  const chat = currentChat();
  if (!chat || chat.messages.length < 2) return;

  const lastUser = [...chat.messages]
    .reverse()
    .find(m => m.role === "user");

  if (!lastUser) return;

  chat.messages = chat.messages.slice(
    0,
    chat.messages.lastIndexOf(lastUser) + 1
  );

  save();
  renderAll();

  await sendMessage(lastUser.content);
}

form.addEventListener("submit", e => {
  e.preventDefault();

  const text = prompt.value.trim();
  if (!text) return;

  prompt.value = "";
  prompt.style.height = "auto";

  sendMessage(text);
});

prompt.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

prompt.addEventListener("input", () => {
  prompt.style.height = "auto";
  prompt.style.height = Math.min(prompt.scrollHeight, 180) + "px";
});

$("#newChat").onclick = newChat;

$("#clearCurrent").onclick = () => {
  const chat = currentChat();
  if (!chat) return;

  chat.messages = [];
  chat.title = "New chat";
  save();
  renderAll();
};

$("#searchChats").addEventListener("input", e => {
  renderChatList(e.target.value);
});

$("#openSidebar").onclick = openSidebar;
$("#closeSidebar").onclick = closeSidebar;
$("#backdrop").onclick = closeSidebar;

const themeToggle = $("#themeToggle");
const dialogTheme = $("#dialogTheme");

function toggleTheme() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("myai_theme", dark ? "dark" : "light");
  themeToggle.querySelector("small").textContent = dark ? "Light" : "Dark";
}

function loadTheme() {
  const dark = localStorage.getItem("myai_theme") === "dark";

  if (dark) {
    document.body.classList.add("dark");
  }

  themeToggle.querySelector("small").textContent =
    dark ? "Light" : "Dark";
}

themeToggle.onclick = toggleTheme;
dialogTheme.onclick = toggleTheme;

$("#settingsBtn").onclick = () => {
  $("#settingsDialog").showModal();
};

$("#closeSettings").onclick = () => {
  $("#settingsDialog").close();
};

$("#deleteAll").onclick = () => {
  if (!confirm("Delete all chats?")) return;

  chats = [];
  currentId = null;

  localStorage.removeItem("myai_chats");
  localStorage.removeItem("myai_current");

  newChat();
};

const mathMode = $("#mathMode");

mathMode.onclick = () => {
  mathMode.classList.toggle("active");

  const enabled = mathMode.classList.contains("active");

  mathMode.textContent = enabled
    ? "🧮 Math On"
    : "🧮 Math";
};

const mathTopic = $("#mathTopic");
const mathHelp = $("#mathHelp");

mathTopic.addEventListener("change", () => {
  if (mathTopic.value) {
    mathMode.classList.add("active");
    mathMode.textContent = "🧮 Math On";
  }
});

mathHelp.querySelectorAll("button").forEach(button => {
  button.onclick = () => {
    prompt.value = button.dataset.math;
    prompt.focus();
    prompt.dispatchEvent(new Event("input"));
  };
});

document.querySelectorAll(".suggestions button").forEach(button => {
  button.onclick = () => {
    prompt.value = button.dataset.prompt;
    prompt.focus();
    prompt.dispatchEvent(new Event("input"));
  };
});

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    newChat();
  }
});

loadTheme();

if (!currentId || !currentChat()) {
  if (chats.length) {
    currentId = chats[0].id;
  } else {
    newChat();
  }
}

renderAll();
