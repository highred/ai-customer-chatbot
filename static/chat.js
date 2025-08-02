const chat  = document.getElementById("chat");
const input = document.getElementById("msg");
document.getElementById("send").onclick = async () => {
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
function append(who,text){
  chat.innerHTML += `<p><b>${who}:</b> ${text}</p>`;
  chat.scrollTop = chat.scrollHeight;
}
