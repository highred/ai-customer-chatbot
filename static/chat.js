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
  const modeBtn = document.getElementById("modeBtn");
  const tempSlider = document.getElementById("tempSlider");
  const tempVal = document.getElementById("tempVal");

  let currentModel = "gpt-4o";
  let currentPersona = "Default";

  tempSlider.addEventListener("input", () => {
    tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
  });

  modeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  chatTab.addEventListener("click", () => {
    chatTab.classList.add("active");
    personalityTab.classList.remove("active");
    documentTab.classList.remove("active");
    chatPane.classList.remove("hidden");
    personalityPane.classList.add("hidden");
    documentPane.classList.add("hidden");
  });

  personalityTab.addEventListener("click", () => {
    chatTab.classList.remove("active");
    personalityTab.classList.add("active");
    documentTab.classList.remove("active");
    chatPane.classList.add("hidden");
    personalityPane.classList.remove("hidden");
    documentPane.classList.add("hidden");
    loadPersonas();
  });

  documentTab.addEventListener("click", () => {
    chatTab.classList.remove("active");
    personalityTab.classList.remove("active");
    documentTab.classList.add("active");
    chatPane.classList.add("hidden");
    personalityPane.classList.add("hidden");
    documentPane.classList.remove("hidden");
    loadFaqs();
  });

  sendBtn.addEventListener("click", sendMessage);
  msgBox.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

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
        model: currentModel,
        persona: currentPersona,
        temperature: tempSlider.value,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        appendMsg("bot", data.answer || "[error]");
        spinner.style.display = "none";
      })
      .catch((err) => {
        appendMsg("bot", "[error]");
        spinner.style.display = "none";
        console.error(err);
      });
  }

  // ===================
  // ADMIN FUNCTIONALITY
  // ===================

  const personaList = document.getElementById("personaList");
  const newPersonaBtn = document.getElementById("newPersona");

  function loadPersonas() {
    fetch("/admin/personas")
      .then((res) => res.json())
      .then((data) => {
        personaList.innerHTML = "";
        for (const name in data) {
          const div = document.createElement("div");
          div.className = "persona-block";
          const activeTag = name === currentPersona ? " (Active)" : "";
          div.innerHTML = `
            <label>${name}${activeTag}</label>
            <textarea>${data[name]}</textarea>
            <button class="save">💾</button>
            ${
              name !== "Default"
                ? '<button class="delete">❌</button>'
                : "<span></span>"
            }
          `;
          const [saveBtn, deleteBtn] = div.querySelectorAll("button");
          saveBtn.onclick = () =>
            savePersona(name, div.querySelector("textarea").value);
          if (deleteBtn)
            deleteBtn.onclick = () => deletePersona(name);
          div.onclick = () => {
            currentPersona = name;
            loadPersonas(); // refresh to show active
          };
          personaList.appendChild(div);
        }
      });
  }

  function savePersona(name, instructions) {
    fetch("/admin/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, instructions }),
    }).then(() => loadPersonas());
  }

  function deletePersona(name) {
    fetch(`/admin/personas/${name}`, {
      method: "DELETE",
    }).then(() => {
      if (name === currentPersona) currentPersona = "Default";
      loadPersonas();
    });
  }

  newPersonaBtn.addEventListener("click", () => {
    const name = prompt("New persona name?");
    if (!name) return;
    savePersona(name, "");
  });

  // ============
  // DOC HANDLER
  // ============
  const faqForm = document.getElementById("faqForm");
  const faqFiles = document.getElementById("faqFiles");
  const dropBox = document.getElementById("dropBox");
  const chunkSize = document.getElementById("chunkSize");
  const faqList = document.getElementById("faqList");
  const clearBtn = document.getElementById("clearBtn");
  const sortDocsBtn = document.getElementById("sortDocs");
  const filterDocs = document.getElementById("filterDocs");

  faqForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = faqFiles.files;
    if (!files.length) return;
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    fetch("/admin/upload", {
      method: "POST",
      headers: { "X-Chunk-Size": chunkSize.value },
      body: formData,
    })
      .then((res) => res.json())
      .then(() => loadFaqs());
  });

  dropBox.addEventListener("click", () => faqFiles.click());
  dropBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropBox.classList.add("drag-over");
  });
  dropBox.addEventListener("dragleave", () => {
    dropBox.classList.remove("drag-over");
  });
  dropBox.addEventListener("drop", (e) => {
    e.preventDefault();
    dropBox.classList.remove("drag-over");
    faqFiles.files = e.dataTransfer.files;
  });

  clearBtn.addEventListener("click", () => {
    fetch("/admin/clear", { method: "POST" }).then(() => {
      chatBox.innerHTML = "";
    });
  });

  sortDocsBtn.addEventListener("click", () => {
    const items = Array.from(faqList.children);
    const sorted = items.sort((a, b) =>
      a.textContent.localeCompare(b.textContent)
    );
    faqList.innerHTML = "";
    for (const item of sorted) faqList.appendChild(item);
  });

  filterDocs.addEventListener("change", () => {
    const ext = filterDocs.value;
    for (const li of faqList.children) {
      const name = li.getAttribute("data-name") || "";
      li.style.display = ext === "all" || name.endsWith(ext) ? "" : "none";
    }
  });

  function loadFaqs() {
    fetch("/admin/faqs")
      .then((res) => res.json())
      .then((data) => {
        faqList.innerHTML = "";
        data.forEach((doc) => {
          const li = document.createElement("li");
          li.setAttribute("data-name", doc.name);
          const chunkInfo =
            doc.chunks !== undefined
              ? `<div class="chunk-info">Chunks: ${doc.chunks}, Skipped: ${doc.skipped}, Tokens: ${doc.token_est}, Cost: $${doc.cost_est}</div>`
              : "";
          li.innerHTML = `
            <strong>${doc.name}</strong>
            ${chunkInfo}
            <button class="delete">❌</button>
          `;
          li.querySelector(".delete").onclick = () => {
            fetch(`/admin/faqs/${doc.id}`, { method: "DELETE" }).then(() =>
              loadFaqs()
            );
          };
          faqList.appendChild(li);
        });
        filterDocs.dispatchEvent(new Event("change"));
      });
  }

  // Autofocus on load
  msgBox.focus();
});
