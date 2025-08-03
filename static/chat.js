document.addEventListener("DOMContentLoaded", () => {
  const msgInput = document.getElementById("msg");
  const chatBox = document.getElementById("chatBox");
  const sendBtn = document.getElementById("send");
  const spinner = document.getElementById("spinner");
  const personaSelect = document.getElementById("personaSelector");
  const tempSlider = document.getElementById("tempSlider");

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
          message,
          persona: personaSelect?.value || "Default",
          temperature: tempSlider?.value || 0.2,
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
    }

    spinner.style.display = "none";
    msgInput.focus();
  };

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("chatTab")?.addEventListener("click", () => {
    setTimeout(() => msgInput.focus(), 100);
  });
});
