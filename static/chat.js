// ── element refs ─────────────────────────────────────────────
const chatTab     = document.getElementById("chatTab");
const adminTab    = document.getElementById("adminTab");
const chatPane    = document.getElementById("chatPane");
const adminPane   = document.getElementById("adminPane");

const chatBox     = document.getElementById("chatBox");
const textarea    = document.getElementById("msg");
const sendBtn     = document.getElementById("send");
const spinner     = document.getElementById("spinner");
const modeBtn     = document.getElementById("modeBtn");

const personaSel  = document.getElementById("personaSel");
const instBox     = document.getElementById("instBox");
const newPersona  = document.getElementById("newPersona");
const savePersona = document.getElementById("savePersona");
const deletePersona = document.getElementById("deletePersona");

const faqForm     = document.getElementById("faqForm");
const faqFiles    = document.getElementById("faqFiles");
const faqList     = document.getElementById("faqList");
const dropBox     = document.getElementById("dropBox");
const uploadBtn   = document.getElementById("uploadBtn");
const clearBtn    = document.getElementById("clearBtn");

const chunkSizeSel= document.getElementById("chunkSize");
const tempSlider  = document.getElementById("tempSlider");
const tempVal     = document.getElementById("tempVal");

// ── dark mode ────────────────────────────────────────────────
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};

// ── tab switching ────────────────────────────────────────────
function showChat() {
  chatTab.classList.add("active");
  adminTab.classList.remove("active");
  chatPane.classList.remove("hidden");
  adminPane.classList.add("hidden");
}
function showAdmin() {
  adminTab.classList.add("active");
  chatTab.classList.remove("active");
  chatPane.classList.add("hidden");
  adminPane.classList.remove("hidden");
}
chatTab.onclick = showChat;
adminTab.onclick = showAdmin;
showChat();

// ── temperature slider ───────────────────────────────────────
tempVal.textContent = (+tempSlider.value).toFixed(2);
tempSlider.oninput = () => tempVal.textContent = (+tempSlider.value).toFixed(2);

// ── helpers ──────────────────────────────────────────────────
const append = (who, text) => {
  chatBox.insertAdjacentHTML("beforeend", `<p><b>${who}:</b> ${text}</p>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};
const busy = (b) => {
  spinner.style.display = b ? "inline-block" : "none";
  sendBtn.disabled = textarea.disabled = b;
};
const j = async (url, opts={}) => (await fetch(url, opts)).json();

// ── Chat send -------------------------------------------------
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
      persona: personaSel.value,
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
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});

// ── Personas --------------------------------------------------
async function loadPersonas() {
  const data = await j("/admin/personas");
  personaSel.innerHTML = "";
  Object.entries(data).forEach(([name]) => {
    const o = document.createElement("option");
    o.value = o.textContent = name;
    personaSel.appendChild(o);
  });
  personaSel.value = "Default";
  instBox.value = data["Default"];
}
personaSel.onchange = async () => {
  instBox.value = (await j("/admin/personas"))[personaSel.value] || "";
};
savePersona.onclick = async () => {
  await fetch("/admin/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: personaSel.value, instructions: instBox.value })
  });
  loadPersonas();
};
newPersona.onclick = () => {
  const n = prompt("New persona name:");
  if (n) { personaSel.value = n; instBox.value = ""; }
};
deletePersona.onclick = async () => {
  const n = personaSel.value;
  if (n === "Default" || !confirm(`Delete persona "${n}"?`)) return;
  await fetch(`/admin/personas/${encodeURIComponent(n)}`, { method: "DELETE" });
  loadPersonas();
};
loadPersonas();

// ── Drag & Drop Upload ----------------------------------------
dropBox.addEventListener("click", () => faqFiles.click());

dropBox.addEventListener("dragover", e => {
  e.preventDefault();
  dropBox.classList.add("drag");
});
dropBox.addEventListener("dragleave", () => dropBox.classList.remove("drag"));
dropBox.addEventListener("drop", e => {
  e.preventDefault();
  dropBox.classList.remove("drag");
  faqFiles.files = e.dataTransfer.files;
  faqForm.dispatchEvent(new Event("submit"));
});

// ── Chunk size memory -----------------------------------------
chunkSizeSel.value = localStorage.getItem("chunkSize") || "50";
chunkSizeSel.onchange = () => localStorage.setItem("chunkSize", chunkSizeSel.value);

// ── Upload ----------------------------------------------------
faqForm.onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData();
  [...faqFiles.files].forEach(f => fd.append("files", f));
  const res = await fetch("/admin/upload", {
    method: "POST",
    headers: { "X-Chunk-Size": chunkSizeSel.value },
    body: fd
  });
  const uploaded = await res.json();
  faqFiles.value = "";
  listFaqs(uploaded);
};

// ── FAQ list --------------------------------------------------
async function listFaqs(uploaded = []) {
  const docs = await j("/admin/faqs");
  faqList.innerHTML = "";

  docs.forEach(d => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${d.name}</b>`;

    if (d.chunks != null) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `Chunks: ${d.chunks}, Skipped: ${d.skipped}, Tokens: ${d.token_est}, Cost: $${d.cost_est.toFixed(5)}`;
      li.appendChild(meta);
    }

    const x = document.createElement("button");
    x.textContent = "✕";
    x.className = "danger";
    x.onclick = async () => {
      await fetch(`/admin/faqs/${d.id}`, { method: "DELETE" });
      listFaqs();
    };
    li.appendChild(x);
    faqList.appendChild(li);
  });
}
listFaqs();

// ── Clear conversation -----------------------------------------
clearBtn.onclick = async () => {
  await fetch("/admin/clear", { method: "POST" });
  chatBox.innerHTML = "";
};
