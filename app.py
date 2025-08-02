import os, uuid, json, threading
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from werkzeug.utils import secure_filename
import openai

# -------------------------------------------------------------------
openai.api_key   = os.getenv("OPENAI_API_KEY")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "changeme123")

app              = Flask(__name__)
app.secret_key   = os.getenv("FLASK_SECRET_KEY","dev-secret")

LOCK             = threading.Lock()

# ---------------- Persistence paths --------------------------------
BASE_DIR         = os.path.abspath(os.path.dirname(__file__))
UPLOAD_DIR       = os.path.join(BASE_DIR, "faq_uploads")
INDEX_FILE       = os.path.join(UPLOAD_DIR, "_index.json")
PERSONA_FILE     = os.path.join(BASE_DIR, "personas.json")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------- Helper for FAQ index -----------------------------
def load_index():
    if not os.path.exists(INDEX_FILE): return []
    with open(INDEX_FILE,"r",encoding="utf-8") as f: return json.load(f)

def save_index(idx):
    with LOCK, open(INDEX_FILE,"w",encoding="utf-8") as f: json.dump(idx, f, indent=2)

def add_doc(file_storage):
    idx  = load_index()
    orig = secure_filename(file_storage.filename)
    uid  = str(uuid.uuid4())
    fname= f"{uid}_{orig}"
    path = os.path.join(UPLOAD_DIR,fname)
    file_storage.save(path)
    idx.append({"id":uid,"name":orig,"file":fname,"size":os.path.getsize(path),
                "uploaded":datetime.utcnow().isoformat()+"Z"})
    save_index(idx)

def delete_doc(doc_id):
    idx = load_index()
    doc = next((d for d in idx if d["id"]==doc_id), None)
    if not doc: return False
    try: os.remove(os.path.join(UPLOAD_DIR, doc["file"]))
    except FileNotFoundError: pass
    idx = [d for d in idx if d["id"]!=doc_id]
    save_index(idx); return True

# ---------------- Persona helpers ----------------------------------
def load_personas():
    if not os.path.exists(PERSONA_FILE):
        with open(PERSONA_FILE,"w",encoding="utf-8") as f:
            json.dump({"Default":"You are a helpful business assistant."},f,indent=2)
    with open(PERSONA_FILE,"r",encoding="utf-8") as f: return json.load(f)

def save_personas(data):
    with LOCK, open(PERSONA_FILE,"w",encoding="utf-8") as f: json.dump(data,f,indent=2)

PERSONAS = load_personas()

# ---------------- Session / auth -----------------------------------
def sid():       return session.setdefault("sid", str(uuid.uuid4()))
def is_admin():  return session.get("is_admin", False)

# ---------------- Routes -------------------------------------------
@app.route("/")
def index(): return render_template("index.html")

@app.route("/admin/login", methods=["POST"])
def admin_login():
    if request.get_json(force=True).get("password")==ADMIN_PASSWORD:
        session["is_admin"]=True; return "",204
    return "unauthorized",401

# ---------- Persona API ----------
@app.route("/admin/personas", methods=["GET","POST"])
def personas():
    if not is_admin(): return "forbidden",403
    if request.method=="GET": return jsonify(PERSONAS)
    data = request.get_json(force=True)
    name, instr = data.get("name","").strip(), data.get("instructions","").strip()
    if not name or not instr: return "bad request",400
    PERSONAS[name]=instr; save_personas(PERSONAS); return "",204

@app.route("/admin/personas/<name>",methods=["DELETE"])
def persona_delete(name):
    if not is_admin(): return "forbidden",403
    if name=="Default": return "cannot delete default",400
    PERSONAS.pop(name,None); save_personas(PERSONAS); return "",204

# ---------- FAQ upload & list ----------
@app.route("/admin/upload", methods=["POST"])
def upload():
    if not is_admin(): return "forbidden",403
    files = request.files.getlist("files")
    if not files: return "no files",400
    for f in files: add_doc(f)
    return "",204

@app.route("/admin/faqs", methods=["GET"])
def list_faqs():
    if not is_admin(): return "forbidden",403
    return jsonify(load_index())

@app.route("/admin/faqs/<doc_id>", methods=["DELETE"])
def del_faq(doc_id):
    if not is_admin(): return "forbidden",403
    if delete_doc(doc_id): return "",204
    return "not found",404

# ---------- Clear conversation only ----------
CONV_HISTORY={}     # {sid: [msgs]}
@app.route("/admin/clear", methods=["POST"])
def clear_conv():
    if not is_admin(): return "forbidden",403
    CONV_HISTORY.pop(sid(),None); return "",204

# ---------- Chat ----------
def combined_faq(limit_chars=4000):
    txt=""
    for doc in load_index():
        path=os.path.join(UPLOAD_DIR,doc["file"])
        try:
            with open(path,"r",encoding="utf-8",errors="ignore") as f:
                txt += f"\n--- {doc['name']} ---\n" + f.read()
        except FileNotFoundError:
            continue
        if len(txt)>=limit_chars: break
    return txt[:limit_chars]

@app.route("/chat", methods=["POST"])
def chat():
    data      = request.get_json(force=True)
    question  = data.get("message","").strip()
    model     = data.get("model","gpt-4o")
    persona   = PERSONAS.get(data.get("persona","Default"), PERSONAS["Default"])
    temperature = float(data.get("temperature",0.2))
    if not question: return jsonify(error="empty"),400

    history   = CONV_HISTORY.setdefault(sid(),[])
    history.append({"role":"user","content":question})
    history   = history[-20:]   # trim

    sys_prompt = (f"{persona}\n\nWhen relevant, answer using these FAQs:\n```\n"
                  f"{combined_faq()}\n```")

    resp = openai.chat.completions.create(
        model=model,
        messages=[{"role":"system","content":sys_prompt}, *history],
        temperature=temperature)

    answer = resp.choices[0].message.content.strip()
    history.append({"role":"assistant","content":answer})
    CONV_HISTORY[sid()] = history
    return jsonify(answer=answer)

# -------------------------------------------------------------------
if __name__=="__main__":
    app.run(debug=True)
