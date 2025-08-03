// ── Tabs ───────────────────────────────────────
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
    chatTab.classList.add("active"); chatPane.classList.remove("hidden");
  } else if (tab === "personality") {
    personalityTab.classList.add("active"); personalityPane.classList.remove("hidden");
  } else {
    documentTab.classList.add("active"); documentPane.classList.remove("hidden");
  }
}
chatTab.onclick = () => showTab("chat");
personalityTab.onclick = () => showTab("personality");
documentTab.onclick = () => showTab("documents");
showTab("chat");

// ── Dark mode ──────────────────────────────────
const modeBtn = document.getElementById("modeBtn");
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};

// ── Header title ───────────────────────────────
const headerInput = document.getElementById("headerTitle");
headerInput.value = localStorage.getItem("chatbotTitle") || "Lets do this Chat";
headerInput.addEventListener("input", () => {
  localStorage.setItem("chatbotTitle", headerInput.value);
});

// ── Chat logic ─────────────────────────────────
const chatBox = document.getElementById("chatBox");
const textarea = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const spinner = document.getElementById("spinner");
const tempSlider = document.getElementById("tempSlider");
const tempVal = document.getElementById("tempVal");

tempVal.textContent = (+tempSlider.value).toFixed(2);
tempSlider.oninput = () => tempVal.textContent = (+tempSlider.value).toFixed(2);

let activePersona = "Default";

const append = (who, text) => {
  chatBox.insertAdjacentHTML("beforeend", `<p><b>${who}:</b> ${text}</p>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};
const busy = (b) => {
  spinner.style.display = b ? "inline-block" : "none";
  sendBtn.disabled = textarea.disabled = b;
};

const j = async (url, opts = {}) => (await fetch(url, opts)).json();

sendBtn.onclick = send;
textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

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
}

// ── Persona logic ──────────────────────────────
const personaList = document.getElementById("personaList");
const newPersonaBtn = document.getElementById("newPersona");

const personaDropdown = document.createElement("select");
personaDropdown.id = "personaSelector";
personaDropdown.onchange = () => {
  activePersona = personaDropdown.value;
};
const personaHeader = document.createElement("div");
personaHeader.innerHTML = `<label>Active Persona: </label>`;
personaHeader.appendChild(personaDropdown);
personaList.before(personaHeader);

async function loadPersonas() {
  const data = await j("/admin/personas");
  personaList.innerHTML = "";
  personaDropdown.innerHTML = "";

  Object.entries(data).forEach(([name, instructions]) => {
    addPersonaBlock(name, instructions);
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    personaDropdown.appendChild(opt);
  });

  personaDropdown.value = activePersona = "Default";
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

newPersonaBtn.onclick = () => {
  const name = prompt("New persona name:");
  if (!name) return;
  addPersonaBlock(name, "");
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  personaDropdown.appendChild(opt);
  personaDropdown.value = activePersona = name;
};

// ── Document Upload ────────────────────────────
const dropBox = document.getElementById("dropBox");
const fileInput = document.getElementById("faqFiles");
const faqForm = document.getElementById("faqForm");
const chunkSizeInput = document.getElementById("chunkSize");
const faqList = document.getElementById("faqList");

dropBox.onclick = () => fileInput.click();
dropBox.ondragover = (e) => {
  e.preventDefault();
  dropBox.classList.add("drag");
};
dropBox.ondragleave = () => dropBox.classList.remove("drag");
dropBox.ondrop = (e) => {
  e.preventDefault();
  dropBox.classList.remove("drag");
  fileInput.files = e.dataTransfer.files;
};

faqForm.onsubmit = async (e) => {
  e.preventDefault();
  const files = fileInput.files;
  if (!files.length) return;

  const form = new FormData();
  for (let f of files) form.append("files", f);

  const res = await fetch("/admin/upload", {
    method: "POST",
    headers: { "X-Chunk-Size": chunkSizeInput.value },
    body: form
  });

  const data = await res.json();
  if (data.length > 0) loadFaqs();
  fileInput.value = "";
};

async function loadFaqs() {
  const files = await j("/admin/faqs");
  faqList.innerHTML = "";

  const sortVal = document.getElementById("sortDocs").value;
  const filterVal = document.getElementById("filterDocs").value;

  files.sort((a, b) => {
    if (sortVal === "name") return a.name.localeCompare(b.name);
    if (sortVal === "date") return new Date(b.uploaded) - new Date(a.uploaded);
    if (sortVal === "type") return a.name.split('.').pop().localeCompare(b.name.split('.').pop());
  });

  const filtered = filterVal === "all"
    ? files
    : files.filter(f => f.name.toLowerCase().endsWith(filterVal));

  for (const f of filtered) {
    const li = document.createElement("li");

    const top = document.createElement("div");
    top.className = "file-row";
    top.innerHTML = `<b>${f.name}</b>`;

    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "danger";
    del.onclick = async () => {
      await fetch(`/admin/faqs/${f.id}`, { method: "DELETE" });
      loadFaqs();
    };
    top.appendChild(del);
    li.appendChild(top);

    if (f.chunks !== undefined) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `Chunks: ${f.chunks}, Skipped: ${f.skipped}, Tokens: ${f.token_est}, Cost: $${f.cost_est}`;
      li.appendChild(meta);
    }

    faqList.appendChild(li);
  }
}

document.getElementById("sortDocs").onchange = loadFaqs;
document.getElementById("filterDocs").onchange = loadFaqs;
document.getElementById("clearBtn").onclick = async () => {
  await fetch("/admin/clear", { method: "POST" });
  alert("Conversation history cleared.");
};

loadFaqs();
loadPersonas();
