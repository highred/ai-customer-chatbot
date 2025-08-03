// ── tab switching ────────────────────────────────────────────
const chatTab       = document.getElementById("chatTab");
const personalityTab= document.getElementById("personalityTab");
const documentTab   = document.getElementById("documentTab");

const chatPane      = document.getElementById("chatPane");
const personalityPane = document.getElementById("personalityPane");
const documentPane  = document.getElementById("documentPane");

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

// ── dark mode ────────────────────────────────────────────────
const modeBtn = document.getElementById("modeBtn");
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};

// ── editable title persistence ───────────────────────────────
const headerInput = document.getElementById("headerTitle");
headerInput.value = localStorage.getItem("chatbotTitle") || "AI Customer Chatbot";
headerInput.addEventListener("input", () => {
  localStorage.setItem("chatbotTitle", headerInput.value);
});

// ── chat functionality ───────────────────────────────────────
const chatBox   = document.getElementById("chatBox");
const textarea  = document.getElementById("msg");
const sendBtn   = document.getElementById("send");
const spinner   = document.getElementById("spinner");
const personaSel= document.getElementById("personaSel");
const tempSlider= document.getElementById("tempSlider");
const tempVal   = document.getElementById("tempVal");

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

// ── persona management ───────────────────────────────────────
const instBox = document.getElementById("instBox");
const newPersona = document.getElementById("newPersona");
const savePersona = document.getElementById("savePersona");
const deletePersona = document.getElementById("deletePersona");

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

// ── drag & drop for documents ────────────────────────────────
const faqForm   = document.getElementById("faqForm");
const faqFiles  = document.getElementById("faqFiles");
const dropBox   = document.getElementById("dropBox");
const uploadBtn = document.getElementById("uploadBtn");
const faqList   = document.getElementById("faqList");
const clearBtn  = document.getElementById("clearBtn");
const chunkSizeSel = document.getElementById("chunkSize");

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

// ── Chunk size memory ────────────────────────────────────────
chunkSizeSel.value = localStorage.getItem("chunkSize") || "50";
chunkSizeSel.onchange = () => localStorage.setItem("chunkSize", chunkSizeSel.value);

// ── Upload & List Docs ───────────────────────────────────────
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

// ── Clear chat ───────────────────────────────────────────────
clearBtn.onclick = async () => {
  await fetch("/admin/clear", { method: "POST" });
  chatBox.innerHTML = "";
};
