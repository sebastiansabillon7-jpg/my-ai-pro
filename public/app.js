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
   body.innerHTML = marked.parse(m.content).replace(/\[([\s\S]*?)\]/g, (match, math) => {
  try {
    return katex.renderToString(math.trim(), { displayMode: true });
  } catch {
    return match;
  }
});
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
      tools.innerHTML = `<button data-copy>Copy</button>${i === chat.messages.length - 1 ? '<button data-regenerate>Regenerate</button>' : ''}`;
      body.appendChild(tools);
      tools.querySelector("[data-copy]").onclick = () => navigator.clipboard.writeText(m.content);
      const regen = tools.querySelector("[data-regenerate]");
      if (regen) regen.onclick = regenerate;
    }
    messagesEl.appendChild(row);
  });
  requestAnimationFrame(() => { const c = $("#conversation"); c.scrollTop = c.scrollHeight; });
}

function renderAll() { renderChatList($("#searchChats").value); renderMessages(); }

async function generateImage(prompt) {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Image generation failed.");
  }

  return data.image;
}

async function sendMessage(text) {
  let chat = currentChat();
  if (!chat) { newChat(); chat = currentChat(); }
  if (!text.trim()) return;

  chat.messages.push({ role:"user", content:text.trim() });
  if (chat.title === "New chat") chat.title = text.trim().slice(0, 42);
  chat.updated = Date.now();
  save(); renderAll();

  sendBtn.disabled = true;
  sendBtn.textContent = "■";
  controller = new AbortController();

  const thinking = { role:"assistant", content:"" };
  chat.messages.push(thinking);
  renderAll();

  try {
    const res = await fetch("/api/chat", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
  messages: chat.messages.slice(0,-1),
  mathMode: mathMode.classList.contains("active")
}),
      signal:controller.signal
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    thinking.content = data.reply;
  } catch (e) {
    thinking.content = e.name === "AbortError" ? "Generation stopped." : "Sorry — " + e.message;
  } finally {
    chat.updated = Date.now(); save(); renderAll();
    sendBtn.disabled = false; sendBtn.textContent = "↑"; controller = null;
  }
}

async function regenerate() {
  const chat = currentChat();
  if (!chat || chat.messages.length < 2) return;
  if (chat.messages.at(-1).role === "assistant") chat.messages.pop();
  const lastUser = [...chat.messages].reverse().find(m => m.role === "user");
  if (!lastUser) return;
  chat.messages.pop(); // remove last user so sendMessage adds it back
  await sendMessage(lastUser.content);
}

form.onsubmit = e => { e.preventDefault(); sendMessage(prompt.value); prompt.value=""; resize(); };
prompt.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
prompt.addEventListener("input", resize);
function resize() { prompt.style.height="auto"; prompt.style.height=Math.min(prompt.scrollHeight,180)+"px"; }

document.querySelectorAll(".suggestions button").forEach(b => b.onclick = () => {
  prompt.value = b.dataset.prompt; resize(); prompt.focus();
});
document.querySelectorAll("#mathHelp button").forEach(b => {
  b.onclick = () => {
    prompt.value = b.dataset.math + ": ";
    resize();
    prompt.focus();
  };
});
const mathMode = $("#mathMode");
const mathTopic = $("#mathTopic");

mathTopic.onchange = () => {
  if (mathTopic.value) {
    prompt.value = `${mathTopic.value} problem: `;
    resize();
    prompt.focus();
  }
};
$("#newChat").onclick = newChat;
$("#searchChats").oninput = e => renderChatList(e.target.value);
$("#sendBtn").onclick = () => {};
$("#clearCurrent").onclick = () => {
  const c=currentChat(); if(!c) return; c.messages=[]; c.title="New chat"; save(); renderAll();
};
$("#openSidebar").onclick = () => { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); };
$("#closeSidebar").onclick = closeSidebar;
$("#backdrop").onclick = closeSidebar;
function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); }

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("myai_dark", dark ? "1" : "0");
  $("#themeToggle small").textContent = dark ? "Light" : "Dark";
}
setTheme(localStorage.getItem("myai_dark") === "1");
$("#themeToggle").onclick = () => setTheme(!document.body.classList.contains("dark"));
$("#settingsBtn").onclick = () => $("#settingsDialog").showModal();
$("#closeSettings").onclick = () => $("#settingsDialog").close();
$("#dialogTheme").onclick = () => setTheme(!document.body.classList.contains("dark"));
$("#deleteAll").onclick = () => {
  if (confirm("Delete every saved chat from this browser?")) {
    chats=[]; currentId=null; localStorage.removeItem("myai_chats"); newChat();
    $("#settingsDialog").close();
  }
};
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==="k") { e.preventDefault(); newChat(); }
  if (e.key==="Escape" && controller) controller.abort();
});

if (!currentId || !chats.length) {
  chats=[]; newChat();
} else {
  renderAll();
}
