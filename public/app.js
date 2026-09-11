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
