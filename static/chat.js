// ── tab switching ───────────────────────────────────────────────
const chatTab = document.getElementById("chatTab");
const personalityTab = document.getElementById("personalityTab");
const documentTab = document.getElementById("documentTab");

const chatPane = document.getElementById("chatPane");
const personalityPane = document.getElementById("personalityPane");
const documentPane = document.getElementById("documentPane");

function showTab(tab) {
  [chatTab, personalityTab, documentTab].forEach(btn => btn.classList.remove("active"));
  [chatPane, personalityPane, documentPane].forEach(p => p.classList.add("hidden"));

  if (tab === "chat") {
    chatTab.classList.add("active");
    chatPane.classList.remove("hidden");
  } else if (tab === "personality") {
    personalityTab.classList.add("active");
    personalityPane.classList.remove("hidden");
  } else if (tab === "documents") {
    documentTab.classList.add("active");
    documentPane.classList.remove("hidden");
  }
}
chatTab.onclick = () => showTab("chat");
personalityTab.onclick = () => showTab("personality");
documentTab.onclick = () => showTab("documents");
showTab("chat");

// ── dark mode ───────────────────────────────────────────────────
const modeBtn = document.getElementById("modeBtn");
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};

// ── title input ─────────────────────────────────────────────────
const headerInput = document.getElementById("headerTitle");
headerInput.value = localStorage.getItem("chatbotTitle") || "Lets do this Chat";
headerInput.addEventListener("input", () => {
  localStorage.setItem("chatbotTitle", headerInput.value);
});

// ── chat logic ─────────────────────────────────────────────────
const chatBox = document.getElementById("chatBox");
const textarea = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const spinner = document.getElementById("spinner");
const tempSlider = document.getElementById("tempSlider");
const tempVal = document.getElementById("tempVal");

tempVal.textContent = (+tempSlider.value).toFixed(2);
tempSlider.oninput = () => tempVal.textContent = (+tempSlider.value).toFixed(2);

const append = (who, text) => {
  chatBox.insertAdjacentHTML("beforeend", `<p><b>${who}:</b> ${text}</p>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};
const busy = (b) => {
  spinner.style.display = b ? "inline-block" : "none";
  sendBtn.disabled = textarea.disabled = b;
};
const j = async (url, opts={}) => (await fetch(url, opts)).json();

let activePersona = "Default";

async function send() {
  const q = textarea.value.trim();
  if (!q) return;
  append("You", q);
  textarea.value = "";

  busy(true);
  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: q,
      model: "gpt-4o",
      persona: activePersona,
      temperature: tempSlider.value
    })
  });
  const data = await res.json();
  append("Bot", data.answer || data.error);
  busy(false);
  textarea.focus();
}
sendBtn.onclick = () => send();
textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); send();
  }
});

// ── persona management ─────────────────────────────────────────
const personaList = document.getElementById("personaList");
const newPersonaBtn = document.getElementById("newPersona");

async function loadPersonas() {
  const data = await j("/admin/personas");
  personaList.innerHTML = "";

  Object.entries(data).forEach(([name, instructions]) => {
    addPersonaBlock(name, instructions);
  });

  activePersona = "Default";
}

function addPersonaBlock(name, instructions = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "persona-entry";

  const title = document.createElement("b");
  title.textContent = name;
  wrapper.appendChild(title);

  const text = document.createElement("textarea");
  text.value = instructions;
  wrapper.appendChild(text);

  const controls = document.createElement("div");
  controls.className = "controls";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾";
  saveBtn.onclick = async () => {
    await fetch("/admin/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, instructions: text.value })
    });
  };

  const delBtn = document.createElement("button");
  delBtn.textContent = "✕";
  delBtn.className = "danger";
  delBtn.onclick = async () => {
    if (name === "Default" || !confirm(`Delete persona "${name}"?`)) return;
    await fetch(`/admin/personas/${encodeURIComponent(name)}`, { method: "DELETE" });
    loadPersonas();
  };

  controls.appendChild(saveBtn);
  controls.appendChild(delBtn);
  wrapper.appendChild(controls);
  personaList.appendChild(wrapper);
}

newPersonaBtn.onclick = async () => {
  const name = prompt("New persona name:");
  if (!name) return;

  addPersonaBlock(name, "");
  // Do NOT POST until user fills it out and clicks save
};

loadPersonas();

// ── document and upload logic omitted for brevity (same as before) ──
// Keep your existing FAQ drag/drop + upload code here if unchanged
