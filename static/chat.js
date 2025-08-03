document.addEventListener("DOMContentLoaded", () => {
  const msgBox = document.getElementById("msg");
  const chatBox = document.getElementById("chatBox");
  const sendBtn = document.getElementById("send");
  const spinner = document.getElementById("spinner");

  const chatTab = document.getElementById("chatTab");
  const personalityTab = document.getElementById("personalityTab");
  const documentTab = document.getElementById("documentTab");

  const chatPane = document.getElementById("chatPane");
  const personalityPane = document.getElementById("personalityPane");
  const documentPane = document.getElementById("documentPane");

  let currentPersona = "Default";

  // ───────────── TAB HANDLING ─────────────
  function switchTab(tab) {
    chatPane.classList.add("hidden");
    personalityPane.classList.add("hidden");
    documentPane.classList.add("hidden");
    chatTab.classList.remove("active");
    personalityTab.classList.remove("active");
    documentTab.classList.remove("active");

    if (tab === "chat") {
      chatPane.classList.remove("hidden");
      chatTab.classList.add("active");
      msgBox.focus();
    } else if (tab === "personality") {
      personalityPane.classList.remove("hidden");
      personalityTab.classList.add("active");
      loadPersonas();
    } else if (tab === "documents") {
      documentPane.classList.remove("hidden");
      documentTab.classList.add("active");
      loadFaqs();
    }
  }

  chatTab.onclick = () => switchTab("chat");
  personalityTab.onclick = () => switchTab("personality");
  documentTab.onclick = () => switchTab("documents");

  // ───────────── CHAT ─────────────
  function appendMsg(role, text) {
    const div = document.createElement("div");
    div.className = role;
    div.innerHTML = `<strong>${role === "user" ? "You" : "Bot"}:</strong> ${text}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function sendMessage() {
    const text = msgBox.value.trim();
    if (!text) return;
    appendMsg("user", text);
    msgBox.value = "";
    msgBox.focus();
    spinner.style.display = "inline-block";

    fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        model: "gpt-4o",
        temperature: parseFloat(document.getElementById("tempSlider").value),
        persona: currentPersona
      })
    })
      .then(res => res.json())
      .then(data => {
        appendMsg("bot", data.answer || "[error]");
        spinner.style.display = "none";
      })
      .catch(err => {
        appendMsg("bot", `[error] ${err.message}`);
        spinner.style.display = "none";
      });
  }

  sendBtn.onclick = sendMessage;
  msgBox.onkeypress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ───────────── PERSONAS ─────────────
  const personaList = document.getElementById("personaList");
  const newPersonaBtn = document.getElementById("newPersona");

  function loadPersonas() {
    fetch("/admin/personas")
      .then(res => res.json())
      .then(data => {
        personaList.innerHTML = "";
        for (const name in data) {
          const div = document.createElement("div");
          div.className = "persona-block";
          div.innerHTML = `
            <label><strong>${name}</strong>${name === currentPersona ? " (Active)" : ""}</label>
            <textarea>${data[name]}</textarea>
            <div class="controls">
              <button class="save">💾</button>
              ${name !== "Default" ? `<button class="delete">❌</button>` : ""}
            </div>
          `;

          div.querySelector(".save").onclick = () => {
            const text = div.querySelector("textarea").value;
            fetch("/admin/personas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, instructions: text })
            }).then(() => loadPersonas());
          };

          if (name !== "Default") {
            div.querySelector(".delete").onclick = () => {
              fetch(`/admin/personas/${name}`, { method: "DELETE" })
                .then(() => {
                  if (currentPersona === name) currentPersona = "Default";
                  loadPersonas();
                });
            };
          }

          div.onclick = () => {
            currentPersona = name;
            loadPersonas();
          };

          personaList.appendChild(div);
        }
      });
  }

  newPersonaBtn.onclick = () => {
    const name = prompt("New persona name?");
    if (name) {
      fetch("/admin/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instructions: "" })
      }).then(() => {
        currentPersona = name;
        loadPersonas();
      });
    }
  };

  // ───────────── DOCUMENTS ─────────────
  const faqList = document.getElementById("faqList");
  const faqForm = document.getElementById("faqForm");
  const faqFiles = document.getElementById("faqFiles");
  const chunkSize = document.getElementById("chunkSize");
  const dropBox = document.getElementById("dropBox");
  const sortDocsBtn = document.getElementById("sortDocs");
  const filterDocs = document.getElementById("filterDocs");

  function loadFaqs() {
    fetch("/admin/faqs")
      .then(res => res.json())
      .then(data => {
        faqList.innerHTML = "";
        data.forEach(doc => {
          const li = document.createElement("li");
          li.setAttribute("data-name", doc.name);
          const chunkStats = doc.chunks !== undefined
            ? `<div class="chunk-info">Chunks: ${doc.chunks}, Skipped: ${doc.skipped}, Tokens: ${doc.token_est}, Cost: $${doc.cost_est}</div>`
            : "";
          li.innerHTML = `
            <strong>${doc.name}</strong>
            ${chunkStats}
            <button class="delete">❌</button>
          `;
          li.querySelector(".delete").onclick = () => {
            fetch(`/admin/faqs/${doc.id}`, { method: "DELETE" })
              .then(() => loadFaqs());
          };
          faqList.appendChild(li);
        });
        filterDocs.dispatchEvent(new Event("change"));
      });
  }

  faqForm.onsubmit = (e) => {
    e.preventDefault();
    const files = faqFiles.files;
    if (!files.length) return;
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    fetch("/admin/upload", {
      method: "POST",
      headers: { "X-Chunk-Size": chunkSize.value },
      body: formData
    })
      .then(res => res.json())
      .then(() => loadFaqs());
  };

  dropBox.onclick = () => faqFiles.click();
  dropBox.ondragover = (e) => {
    e.preventDefault();
    dropBox.classList.add("drag");
  };
  dropBox.ondragleave = () => {
    dropBox.classList.remove("drag");
  };
  dropBox.ondrop = (e) => {
    e.preventDefault();
    dropBox.classList.remove("drag");
    faqFiles.files = e.dataTransfer.files;
  };

  sortDocsBtn.onclick = () => {
    const items = Array.from(faqList.children);
    const sorted = items.sort((a, b) =>
      a.getAttribute("data-name").localeCompare(b.getAttribute("data-name"))
    );
    faqList.innerHTML = "";
    for (const item of sorted) faqList.appendChild(item);
  };

  filterDocs.onchange = () => {
    const type = filterDocs.value;
    for (const li of faqList.children) {
      const name = li.getAttribute("data-name") || "";
      li.style.display = type === "all" || name.endsWith(type) ? "" : "none";
    }
  };

  document.getElementById("clearBtn").onclick = () => {
    fetch("/admin/clear", { method: "POST" }).then(() => {
      chatBox.innerHTML = "";
    });
  };

  // Autofocus on load
  msgBox.focus();
});
