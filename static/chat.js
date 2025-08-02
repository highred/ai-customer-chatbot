// ================= element refs =================
const chatTab   = document.getElementById("chatTab");
const adminTab  = document.getElementById("adminTab");
const chatPane  = document.getElementById("chatPane");
const adminPane = document.getElementById("adminPane");

const chatBox   = document.getElementById("chatBox");
const textarea  = document.getElementById("msg");
const sendBtn   = document.getElementById("send");
const spinner   = document.getElementById("spinner");
const modeBtn   = document.getElementById("modeBtn");

const personaSel    = document.getElementById("personaSel");
const instBox       = document.getElementById("instBox");
const newPersona    = document.getElementById("newPersona");
const savePersona   = document.getElementById("savePersona");
const deletePersona = document.getElementById("deletePersona");

const faqForm   = document.getElementById("faqForm");
const faqFiles  = document.getElementById("faqFiles");
const faqList   = document.getElementById("faqList");
const clearBtn  = document.getElementById("clearBtn");

const tempSlider = document.getElementById("tempSlider");
const tempVal    = document.getElementById("tempVal");

let isAdmin=false;

// ================= helpers ======================
function append(who,text){
  chatBox.innerHTML += `<p><b>${who}:</b> ${text}</p>`;
  chatBox.scrollTop  = chatBox.scrollHeight;
}
function busy(b){
  spinner.style.display = b ? "inline-block" : "none";
  sendBtn.disabled      = textarea.disabled = b;
}
async function fetchJSON(url,opts={}){const r=await fetch(url,opts);return r.json();}

// ================= chat logic ===================
async function send(){
  const q = textarea.value.trim();
  if(!q) return;
  append("You", q);
  textarea.value = "";
  busy(true);
  const res = await fetch("/chat", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      message:q,
      model:"gpt-4o",
      persona:personaSel.value,
      temperature:+tempSlider.value
    })
  });
  const data = await res.json();
  append("Bot", data.answer || data.error);
  busy(false);
  textarea.focus();                 // <-- cursor returns here
}
sendBtn.onclick = send;
textarea.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}
});

// ================= persona dropdown =============
async function loadPersonas(){
  const data = await fetchJSON("/admin/personas");
  personaSel.innerHTML="";
  Object.keys(data).forEach(k=>{
    const o=document.createElement("option");o.value=o.textContent=k;personaSel.appendChild(o);
  });
  personaSel.value="Default"; instBox.value=data["Default"];
}
personaSel.onchange=async()=>{instBox.value=(await fetchJSON("/admin/personas"))[personaSel.value]||""};

// ================= persona CRUD =================
newPersona.onclick=()=>{
  const name=prompt("New persona name:")?.trim();
  if(!name) return;
  if(![...personaSel.options].some(o=>o.value===name)){
    const o=document.createElement("option");o.value=o.textContent=name;personaSel.appendChild(o);
  }
  personaSel.value=name; instBox.value="Describe this persona here…"; instBox.focus();
};
savePersona.onclick=async()=>{
  if(!instBox.value.trim()) return alert("Instructions required");
  await fetch("/admin/personas",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:personaSel.value,instructions:instBox.value})});
  await loadPersonas(); alert("Saved!");
};
deletePersona.onclick=async()=>{
  if(personaSel.value==="Default") return alert("Cannot delete default");
  if(!confirm(`Delete persona "${personaSel.value}"?`))return;
  await fetch(`/admin/personas/${encodeURIComponent(personaSel.value)}`,{method:"DELETE"});
  await loadPersonas();
};

// ================= FAQ upload & list ============
async function refreshFaqList(){
  const docs=await fetchJSON("/admin/faqs");
  faqList.innerHTML="";
  docs.forEach(d=>{
    const li=document.createElement("li");
    li.innerHTML=`<span>${d.name}</span>`;
    const del=document.createElement("button");del.textContent="❌";
    del.onclick=async()=>{
      if(!confirm(`Delete "${d.name}"?`))return;
      await fetch(`/admin/faqs/${d.id}`,{method:"DELETE"});
      refreshFaqList();
    };
    li.appendChild(del); faqList.appendChild(li);
  });
}
faqForm.onsubmit=async e=>{
  e.preventDefault();
  if(!faqFiles.files.length) return alert("Choose file(s)");
  const fd=new FormData();[...faqFiles.files].forEach(f=>fd.append("files",f));
  await fetch("/admin/upload",{method:"POST",body:fd});
  faqFiles.value=""; refreshFaqList();
};

// =============== clear conversation only =======
clearBtn.onclick=async()=>{
  if(!confirm("Clear chat history (FAQ files stay)?"))return;
  await fetch("/admin/clear",{method:"POST"});
  chatBox.innerHTML="";
};

// =============== dark-mode toggle ===============
modeBtn.onclick=()=>{
  document.body.classList.toggle("dark");
  modeBtn.textContent=document.body.classList.contains("dark")?"☀️":"🌙";
};

// =============== temperature slider  ============
tempVal.textContent=(+tempSlider.value).toFixed(2);
tempSlider.oninput=()=>tempVal.textContent=(+tempSlider.value).toFixed(2);

// =============== tab switching ==================
function activate(tab){
  if(tab==="chat"){
    chatTab.classList.add("active"); adminTab.classList.remove("active");
    chatPane.classList.remove("hidden"); adminPane.classList.add("hidden");
    textarea.focus();
  }else{
    adminTab.classList.add("active"); chatTab.classList.remove("active");
    adminPane.classList.remove("hidden"); chatPane.classList.add("hidden");
  }
}
chatTab.onclick = ()=>activate("chat");
adminTab.onclick= async()=>{
  if(!isAdmin){
    const pw=prompt("Admin password:");
    if(!pw) return;
    const r=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({password:pw})});
    if(r.status!==204) return alert("Wrong password");
    isAdmin=true; await loadPersonas(); await refreshFaqList();
  }
  activate("admin");
};

// =============== initial focus ==================
textarea.focus();
