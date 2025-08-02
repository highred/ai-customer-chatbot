// ---------- element refs ----------
const chat       = document.getElementById("chat");
const textarea   = document.getElementById("msg");
const sendBtn    = document.getElementById("send");
const spinner    = document.getElementById("spinner");
const modeBtn    = document.getElementById("modeBtn");

const adminToggle=document.getElementById("adminToggle");
const adminPanel =document.getElementById("adminPanel");
const closeAdmin =document.getElementById("closeAdmin");

const personaSel =document.getElementById("personaSel");
const instBox    =document.getElementById("instBox");
const newPersona =document.getElementById("newPersona");
const savePersona=document.getElementById("savePersona");
const deletePersona=document.getElementById("deletePersona");

const faqForm    =document.getElementById("faqForm");
const faqFiles   =document.getElementById("faqFiles");
const faqList    =document.getElementById("faqList");
const clearBtn   =document.getElementById("clearBtn");

const tempSlider = document.getElementById("tempSlider");
const tempVal    = document.getElementById("tempVal");
tempVal.textContent = (+tempSlider.value).toFixed(2);
tempSlider.oninput  = () => tempVal.textContent = (+tempSlider.value).toFixed(2);

let isAdmin=false, panelVisible=false;

// ---------- helpers ----------
function append(who,text){chat.innerHTML+=`<p><b>${who}:</b> ${text}</p>`; chat.scrollTop=chat.scrollHeight;}
function busy(b){spinner.style.display=b?"inline-block":"none"; sendBtn.disabled=textarea.disabled=b;}
async function fetchJSON(url,opts={}){const r=await fetch(url,opts); return r.json();}

// ---------- persona dropdown ----------
async function loadPersonas(){
  const data = await fetchJSON("/admin/personas");
  personaSel.innerHTML="";
  for(const k of Object.keys(data)){
    const o=document.createElement("option"); o.value=k; o.textContent=k; personaSel.appendChild(o);}
  personaSel.value="Default"; instBox.value=data["Default"];
}
personaSel.onchange=async()=>{const d=await fetchJSON("/admin/personas"); instBox.value=d[personaSel.value]||""};

// ---------- FAQ list ----------
async function refreshFaqList(){
  const docs = await fetchJSON("/admin/faqs");
  faqList.innerHTML="";
  docs.forEach(doc=>{
    const li=document.createElement("li");
    li.innerHTML=`<span>${doc.name}</span>`;
    const del=document.createElement("button"); del.textContent="❌";
    del.onclick=async()=>{
      if(!confirm(`Delete "${doc.name}"?`))return;
      await fetch(`/admin/faqs/${doc.id}`,{method:"DELETE"});
      refreshFaqList();
    };
    li.appendChild(del); faqList.appendChild(li);
  });
}

// ---------- send message ----------
async function send(){
  const q=textarea.value.trim(); if(!q)return;
  append("You",q); textarea.value=""; busy(true);
  const res=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({
         message:q,
         model:"gpt-4o",
         persona:personaSel.value,
         temperature:+tempSlider.value
       })});
  const data=await res.json(); append("Bot",data.answer||data.error); busy(false);
}
sendBtn.onclick=send;
textarea.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});

// ---------- admin toggle ----------
adminToggle.onclick=async()=>{
  if(!isAdmin){
    const pw=prompt("Admin password:"); if(!pw)return;
    const r=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},
               body:JSON.stringify({password:pw})});
    if(r.status!==204){alert("Wrong password");return;}
    isAdmin=true; await loadPersonas(); await refreshFaqList();
  }
  panelVisible=!panelVisible;
  adminPanel.classList.toggle("hidden",!panelVisible);
  adminToggle.textContent=panelVisible?"Hide Admin":"Admin Panel";
};
closeAdmin.onclick=()=>{panelVisible=false;adminPanel.classList.add("hidden");adminToggle.textContent="Admin Panel"};

// ---------- persona CRUD ----------
newPersona.onclick = () => {
  const name = prompt("New persona name:")?.trim();
  if(!name)return;
  let opt=[...personaSel.options].find(o=>o.value===name);
  if(!opt){opt=document.createElement("option");opt.value=opt.textContent=name;personaSel.appendChild(opt);}
  personaSel.value=name;instBox.value="Describe this persona here…";instBox.focus();
};
savePersona.onclick=async()=>{
  const name=personaSel.value.trim(), txt=instBox.value.trim();
  if(!name||!txt)return alert("Name & text required");
  await fetch("/admin/personas",{method:"POST",headers:{"Content-Type":"application/json"},
         body:JSON.stringify({name,instructions:txt})});
  await loadPersonas(); personaSel.value=name; alert("Saved!");
};
deletePersona.onclick=async()=>{
  const name=personaSel.value; if(name==="Default")return alert("Cannot delete default");
  if(!confirm(`Delete persona "${name}"?`))return;
  await fetch(`/admin/personas/${encodeURIComponent(name)}`,{method:"DELETE"});
  await loadPersonas(); alert("Deleted");
};

// ---------- FAQ upload ----------
faqForm.onsubmit=async e=>{
  e.preventDefault();
  if(!faqFiles.files.length)return alert("Choose file(s)");
  const fd=new FormData();
  [...faqFiles.files].forEach(f=>fd.append("files",f));
  await fetch("/admin/upload",{method:"POST",body:fd});
  faqFiles.value="";   // reset
  refreshFaqList();
};

// ---------- clear conversation (not FAQs) ----------
clearBtn.onclick=async()=>{
  if(!confirm("Clear chat history (FAQ files stay)?"))return;
  await fetch("/admin/clear",{method:"POST"});
  chat.innerHTML="";
};

// ---------- dark mode ----------
modeBtn.onclick=()=>{document.body.classList.toggle("dark");
  modeBtn.textContent=document.body.classList.contains("dark")?"☀️":"🌙";};
