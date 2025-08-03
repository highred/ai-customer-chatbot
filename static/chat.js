// ── Tab switching ───────────────────────────────────────────────
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

// ── Dark mode ───────────────────────────────────────────────────
const modeBtn = document.getElementById("modeBtn");
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};

// ── Header title persistence ───────────────────────────────────
const headerInput = document.getElementById("headerTitle");
headerInput.value = localStorage.getItem("chatbotTitle") || "AI Customer Chatbot";
headerInput.addEventListener("input", () => {
  localStorage.setItem("chatbotTitle", headerInput.value);
});

// ── Chat logic ─────────────────────────────────────────────────
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

// ── Persona list ───────────────────────────────────────────────
const personaList = document.getElementById("personaList");
const newPersonaBtn = document.getElementById("newPersona");

async function loadPersonas() {
  const data = await j("/admin/personas");
  personaList.innerHTML = "";

  Object.entries(data).forEach(([name, instructions]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "persona-entry";

    const title = document.createElement("b");
    title.textContent = name;
    wrapper.appendChild(title);

    const textarea = document.createElement("textarea");
    textarea.value = instructions;
    wrapper.appendChild(textarea);

    const controls = document.createElement("div");
    controls.className = "controls";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾";
    saveBtn.onclick = async () => {
      await fetch("/admin/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instructions: textarea.value })
      });
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "✕";
    deleteBtn.className = "danger";
    deleteBtn.onclick = async () => {
      if (name === "Default" || !confirm(`Delete persona "${name}"?`)) return;
      await fetch(`/admin/personas/${encodeURIComponent(name)}`, { method: "DELETE" });
      loadPersonas();
    };

    controls.appendChild(saveBtn);
    controls.appendChild(deleteBtn);
    wrapper.appendChild(controls);
    personaList.appendChild(wrapper);
  });

  activePersona = "Default";
}
newPersonaBtn.onclick = () => {
  const name = prompt("New persona name:");
  if (name) {
    fetch("/admin/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, instructions: "" })
    }).then(loadPersonas);
  }
};
loadPersonas();

// ── File upload + sorting/filtering ───────────────────────────
const faqForm = document.getElementById("faqForm");
const faqFiles = document.getElementById("faqFiles");
const dropBox = document.getElementById("dropBox");
const faqList = document.getElementById("faqList");
const chunkSizeSel = document.getElementById("chunkSize");
const clearBtn = document.getElementById("clearBtn");

const filterDocs = document.getElementById("filterDocs");
const sortDocs = document.getElementById("sortDocs");

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

chunkSizeSel.value = localStorage.getItem("chunkSize") || "50";
chunkSizeSel.onchange = () => localStorage.setItem("chunkSize", chunkSizeSel.value);

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

clearBtn.onclick = async () => {
  await fetch("/admin/clear", { method: "POST" });
  chatBox.innerHTML = "";
};

filterDocs.onchange = listFaqs;
sortDocs.onchange = listFaqs;

async function listFaqs(override = null) {
  let docs = await j("/admin/faqs");
  const type = filterDocs.value;
  const sort = sortDocs.value;

  if (type !== "all") {
    docs = docs.filter(d => d.name.toLowerCase().endsWith(type));
  }

  if (sort === "name") {
    docs.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "date") {
    docs.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
  } else if (sort === "type") {
    docs.sort((a, b) => {
      const extA = a.name.split('.').pop(), extB = b.name.split('.').pop();
      return extA.localeCompare(extB);
    });
  }

  faqList.innerHTML = "";
  docs.forEach(d => {
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `<b>${d.name}</b>`;

    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "danger";
    del.onclick = async () => {
      await fetch(`/admin/faqs/${d.id}`, { method: "DELETE" });
      listFaqs();
    };
    row.appendChild(del);
    li.appendChild(row);

    if (d.chunks != null) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `Chunks: ${d.chunks}, Skipped: ${d.skipped}, Tokens: ${d.token_est}, Cost: $${d.cost_est.toFixed(5)}`;
      li.appendChild(meta);
    }

    faqList.appendChild(li);
  });
}
listFaqs();
