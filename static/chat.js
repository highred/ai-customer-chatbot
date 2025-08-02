// --- helpers -------------------------------------------------------
function append(who,text){
  const chat = document.getElementById("chat");
  chat.innerHTML += `<p><b>${who}:</b> ${text}</p>`;
  chat.scrollTop = chat.scrollHeight;
}

// --- send message --------------------------------------------------
document.getElementById("send").onclick = async () => {
  const input = document.getElementById("msg");
  const q = input.value.trim();
  if(!q) return;
  append("You", q);
  input.value = "";

  const r = await fetch("/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:q})
  });
  const data = await r.json();
  append("Bot", data.answer || data.error);
};

// --- FAQ upload ----------------------------------------------------
document.getElementById("faqForm").onsubmit = async e => {
  e.preventDefault();
  const fileField = document.getElementById("faqFile");
  if (!fileField.files.length){
    alert("Choose a file first"); return;
  }
  const formData = new FormData();
  formData.append("file", fileField.files[0]);

  const res = await fetch("/upload", {method:"POST", body:formData});
  const status = document.getElementById("uploadStatus");
  status.textContent = res.ok ? await res.text() : "Upload failed";
};
