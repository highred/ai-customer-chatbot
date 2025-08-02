// ----- refs -----
const chat=document.getElementById("chat");
const textarea=document.getElementById("msg");
const sendBtn=document.getElementById("send");
const spinner=document.getElementById("spinner");
const modeBtn=document.getElementById("modeBtn");

const adminToggle=document.getElementById("adminToggle");
const adminPanel=document.getElementById("adminPanel");
const closeAdmin=document.getElementById("closeAdmin");
const modelSel=document.getElementById("modelSel");
const instBox=document.getElementById("instBox");
const faqForm=document.getElementById("faqForm");
const clearBtn=document.getElementById("clearBtn");
const uploadStatus=document.getElementById("uploadStatus");

let isAdmin=false, panelVisible=false;

// ----- helpers -----
function append(who,text){chat.innerHTML+=`<p><b>${who}:</b> ${text}</p>`;chat.scrollTop=chat.scrollHeight}
function busy(b){spinner.style.display=b?"inline-block":"none";sendBtn.disabled=textarea.disabled=b}

// ----- send -----
async function send(){
  const q=textarea.value.trim(); if(!q)return;
  append("You",q); textarea.value=""; busy(true);
  const res=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({message:q,model:modelSel.value,instructions:instBox.value})});
  const data=await res.json(); append("Bot",data.answer||data.error); busy(false);
}
sendBtn.onclick=send;
textarea.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});

// ----- admin login & toggle -----
adminToggle.onclick=async()=>{
  if(!isAdmin){
    const pw=prompt("Admin password:"); if(!pw)return;
    const r=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},
               body:JSON.stringify({password:pw})});
    if(r.status!==204){alert("Wrong password");return;}
    isAdmin=true;
  }
  panelVisible=!panelVisible;
  adminPanel.classList.toggle("hidden",!panelVisible);
  adminToggle.textContent=panelVisible?"Hide Admin":"Admin Panel";
};
closeAdmin.onclick=()=>{panelVisible=false;adminPanel.classList.add("hidden");adminToggle.textContent="Admin Panel"};

// ----- faq upload -----
faqForm.onsubmit=async e=>{
  e.preventDefault();
  const f=document.getElementById("faqFile").files[0];
  if(!f) return alert("Choose a file");
  const fd=new FormData(); fd.append("file",f);
  const r=await fetch("/upload",{method:"POST",body:fd});
  uploadStatus.textContent=r.ok?await r.text():"Upload failed";
};

// ----- clear -----
clearBtn.onclick=async()=>{
  if(!confirm("Clear conversation & FAQ?"))return;
  await fetch("/admin/clear",{method:"POST"});
  chat.innerHTML=""; uploadStatus.textContent="";
};

// ----- dark mode -----
modeBtn.onclick=()=>{document.body.classList.toggle("dark");
  modeBtn.textContent=document.body.classList.contains("dark")?"☀️":"🌙";
};
