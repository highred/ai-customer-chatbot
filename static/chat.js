document.addEventListener("DOMContentLoaded", () => {
  const msgInput = document.getElementById("msg");
  const chatBox = document.getElementById("chatBox");
  const sendBtn = document.getElementById("send");
  const spinner = document.getElementById("spinner");
  const tempSlider = document.getElementById("tempSlider");
  const personaSelect = document.getElementById("personaSelector");

  const appendMessage = (sender, text) => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${sender}:</b> ${text}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const sendMessage = async () => {
    const message = msgInput.value.trim();
    if (!message) return;

    appendMessage("You", message);
    msgInput.value = "";
    msgInput.focus();
    spinner.style.display = "inline-block";

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          temperature: parseFloat(tempSlider?.value || 0.2),
          persona: personaSelect?.value || "Default"
        }),
      });

      const data = await res.json();
      if (data.answer) {
        appendMessage("Bot", data.answer);
      } else {
        appendMessage("Bot", `Error: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      appendMessage("Bot", `Error: ${err.message}`);
    } finally {
      spinner.style.display = "none";
      msgInput.focus();
    }
  };

  sendBtn.addEventListener("click", sendMessage);

  msgInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Restore focus when switching back to Chat tab
  document.getElementById("chatTab")?.addEventListener("click", () => {
    setTimeout(() => msgInput.focus(), 100);
  });

  // Sync temperature value display (if element exists)
  const tempVal = document.getElementById("tempVal");
  if (tempSlider && tempVal) {
    tempSlider.addEventListener("input", () => {
      tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
    });
  }
});
