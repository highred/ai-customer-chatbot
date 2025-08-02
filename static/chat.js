// -------- elements -----------------------------------------------
const chat     = document.getElementById("chat");
const input    = document.getElementById("msg");
const sendBtn  = document.getElementById("send");
const spinner  = document.getElementById("spinner");
const modelSel = document.getElementById("modelSel");

// -------- helpers -------------------------------------------------
function append(who,text){
  chat.innerHTML += `<p><b>${who}:</b> ${text}</p>`;
  chat.scrollTop  = chat.scrollHeight;
}
function setLoading(s){
  spinner.style.display = s ? "inline-block" : "none";
  sendBtn.disabled = s; input.disabled = s; modelSel.disabled = s;
}

// -------- send function ------------------------------------------
async function send(){
  const q = input.value.trim();
  if(!q) return;
  append("You", q);
  input.value = ""; setLoading(true);

  const r = await fetch("/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:q, model:modelSel.value})
  });
  const data = await r.json();
  append("Bot", data.answer || data.error);
  setLoading(false);
}
sendBtn.onclick = send;
input.onkeydown = e => { if(e.key==="Enter"){ e.preventDefault(); send(); }};

// -------- FAQ upload ---------------------------------------------
document.getElementById("faqForm").onsubmit = async e => {
  e.preventDefault();
  const fileField = document.getElementById("faqFile");
  if (!fileField.files.length){ alert("Choose a file first"); return; }
  const fd = new FormData(); fd.append("file", fileField.files[0]);
  const res = await fetch("/upload",{method:"POST",body:fd});
  document.getElementById("uploadStatus").textContent =
    res.ok ? await res.text() : "Upload failed";
};

// -------- dark mode toggle ---------------------------------------
document.getElementById("modeBtn").onclick = () => {
  document.body.classList.toggle("dark");
  const m = document.getElementById("modeBtn");
  m.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
};
