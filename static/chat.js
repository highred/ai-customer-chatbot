// ---------- element refs ----------
const chat      = document.getElementById("chat");
const textarea  = document.getElementById("msg");
const sendBtn   = document.getElementById("send");
const spinner   = document.getElementById("spinner");
const modeBtn   = document.getElementById("modeBtn");

const adminToggle=document.getElementById("adminToggle");
const adminPanel =document.getElementById("adminPanel");
const closeAdmin =document.getElementById("closeAdmin");

const personaSel =document.getElementById("personaSel");
const instBox    =document.getElementById("instBox");
const newPersona =document.getElementById("newPersona");
const savePersona=document.getElementById("savePersona");
const deletePersona=document.getElementById("deletePersona");

const faqForm    =document.getElementById("faqForm");
const clearBtn   =document.getElementById("clearBtn");
const uploadStatus=document.getElementById("uploadStatus");

let isAdmin=false, panelVisible=false;

// ---------- helpers ----------
function append(who,text){chat.innerHTML+=`<p><b>${who}:</b> ${text}</p>`; chat.scrollTop=chat.scrollHeight;}
function busy(b){spinner.style.display=b?"inline-block":"none"; sendBtn.disabled=textarea.disabled=b;}
async function fetchJSON(url){const r=await fetch(url);return r.json();}

// ---------- populate persona dropdown ----------
async function loadPersonas(){
  const data = await fetchJSON("/admin/personas");
  personaSel.innerHTML="";
  Object.keys(data).forEach(name=>{
    const opt=document.createElement("option"); opt.value=name; opt.textContent=name;
    personaSel.appendChild(opt);
  });
  personaSel.value="Default";
  instBox.value=data["Default"];
}
personaSel.onchange=async()=>{const d=await fetchJSON("/admin/personas"); instBox.value=d[personaSel.value]||""};

// ---------- send message ----------
async function send(){
  const q=textarea.value.trim(); if(!q)return;
  append("You",q); textarea.value=""; busy(true);
  const res=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({message:q,model:"gpt-4o",persona:personaSel.value})});
  const data=await res.json(); append("Bot",data.answer||data.error); busy(false);
}
sendBtn.onclick=send;
textarea.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});

// ---------- admin login toggle ----------
adminToggle.onclick=async()=>{
  if(!isAdmin){
    const pw=prompt("Admin password:"); if(!pw)return;
    const r=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},
               body:JSON.stringify({password:pw})});
    if(r.status!==204){alert("Wrong password");return;}
    isAdmin=true; await loadPersonas();
  }
  panelVisible=!panelVisible;
  adminPanel.classList.toggle("hidden",!panelVisible);
  adminToggle.textContent=panelVisible?"Hide Admin":"Admin Panel";
};
closeAdmin.onclick=()=>{panelVisible=false;adminPanel.classList.add("hidden");adminToggle.textContent="Admin Panel"};

// ---------- persona CRUD ----------
newPersona.onclick=()=>{
  const name=prompt("New persona name:"); if(!name)return;
  personaSel.value=name; instBox.value="Describe this persona here…";
};
savePersona.onclick=async()=>{
  const name=personaSel.value.trim(); const txt=instBox.value.trim();
  if(!name||!txt)return alert("Name & text required");
  await fetch("/admin/personas",{method:"POST",headers:{"Content-Type":"application/json"},
         body:JSON.stringify({name:name,instructions:txt})});
  await loadPersonas(); personaSel.value=name; alert("Saved!");
};
deletePersona.onclick=async()=>{
  const name=personaSel.value;
  if(name==="Default")return alert("Cannot delete default");
  if(!confirm(`Delete persona "${name}"?`))return;
  await fetch(`/admin/personas/${encodeURIComponent(name)}`,{method:"DELETE"});
  await loadPersonas(); alert("Deleted");
};

// ---------- faq upload ----------
faqForm.onsubmit=async e=>{
  e.preventDefault();
  const f=document.getElementById("faqFile").files[0];
  if(!f)return alert("Choose file");
  const fd=new FormData();fd.append("file",f);
  const r=await fetch("/upload",{method:"POST",body:fd});
  uploadStatus.textContent=r.ok?await r.text():"Upload failed";
};

// ---------- clear session ----------
clearBtn.onclick=async()=>{
  if(!confirm("Clear conversation & FAQ?"))return;
  await fetch("/admin/clear",{method:"POST"});
  chat.innerHTML=""; uploadStatus.textContent="";
};

// ---------- dark mode ----------
modeBtn.onclick=()=>{document.body.classList.toggle("dark");
  modeBtn.textContent=document.body.classList.contains("dark")?"☀️":"🌙";};
