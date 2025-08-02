// ---------- helpers -------------------------
const chat      = document.getElementById("chat");
const input     = document.getElementById("msg");
const sendBtn   = document.getElementById("send");
const spinner   = document.getElementById("spinner");
function append(who,text){
  chat.innerHTML += `<p><b>${who}:</b> ${text}</p>`;
  chat.scrollTop  = chat.scrollHeight;
}
function setLoading(state){
  spinner.style.display = state ? "inline" : "none";
  sendBtn.disabled = state;
}

// ---------- send message --------------------
async function send(){
  const q = input.value.trim();
  if(!q) return;
  append("You", q);
  input.value = "";
  setLoading(true);

  const r = await fetch("/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:q})
  });
  const data = await r.json();
  append("Bot", data.answer || data.error);
  setLoading(false);
}
sendBtn.onclick = send;
input.onkeydown = e => { if(e.key==="Enter"){ e.preventDefault(); send(); }};

// ---------- FAQ upload ----------------------
document.getElementById("faqForm").onsubmit = async e => {
  e.preventDefault();
  const fileField = document.getElementById("faqFile");
  if (!fileField.files.length){
    alert("Choose a file first"); return;
  }
  const formData = new FormData();
  formData.append("file", fileField.files[0]);

  const res = await fetch("/upload", {method:"POST", body:formData});
  document.getElementById("uploadStatus").textContent =
    res.ok ? await res.text() : "Upload failed";
};

// ---------- dark-mode toggle ----------------
const modeBtn = document.getElementById("modeBtn");
modeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  modeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};
