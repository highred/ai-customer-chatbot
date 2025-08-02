import os
import uuid
import json
import threading
from datetime import datetime

from flask import Flask, request, jsonify, render_template, session
from werkzeug.utils import secure_filename
import openai

# ---------- optional & format-specific text-extract libs ----------
from PyPDF2 import PdfReader
import docx          # python-docx
try:
    import textract  # only needed for legacy .doc
except ImportError:
    textract = None

# ------------------------------------------------------------------
openai.api_key  = os.getenv("OPENAI_API_KEY")
ADMIN_PASSWORD  = os.getenv("ADMIN_PASSWORD", "changeme123")

app            = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

LOCK = threading.Lock()

# ---------- persistence paths -------------------------------------
BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
UPLOAD_DIR   = os.path.join(BASE_DIR, "faq_uploads")
INDEX_FILE   = os.path.join(UPLOAD_DIR, "_index.json")
PERSONA_FILE = os.path.join(BASE_DIR, "personas.json")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------- helpers: FAQ index ------------------------------------
def load_index() -> list:
    if not os.path.exists(INDEX_FILE):
        return []
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_index(idx: list) -> None:
    with LOCK, open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(idx, f, indent=2)

# ---------- text extraction ---------------------------------------
def extract_text(path: str, ext: str) -> str:
    try:
        if ext == ".txt":
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        if ext == ".pdf":
            out = []
            for page in PdfReader(path).pages:
                out.append(page.extract_text() or "")
            return "\n".join(out)

        if ext == ".docx":
            d = docx.Document(path)
            return "\n".join(p.text for p in d.paragraphs)

        if ext == ".doc" and textract:
            return textract.process(path).decode("utf-8", "ignore")

    except Exception as exc:
        print("Text extraction failed:", exc)

    return ""  # fallback on failure

# ---------- add & delete docs -------------------------------------
def add_doc(file_storage) -> None:
    idx  = load_index()
    orig = secure_filename(file_storage.filename)
    ext  = os.path.splitext(orig)[1].lower()
    uid  = str(uuid.uuid4())

    # save binary
    bin_fname = f"{uid}{ext}"
    bin_path  = os.path.join(UPLOAD_DIR, bin_fname)
    file_storage.save(bin_path)

    # guarantee a .txt with extracted text
    if ext == ".txt":
        txt_fname, txt_path = bin_fname, bin_path
    else:
        txt_fname = f"{uid}.txt"
        txt_path  = os.path.join(UPLOAD_DIR, txt_fname)
        text = extract_text(bin_path, ext)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

    idx.append({
        "id": uid,
        "name": orig,
        "file": bin_fname,
        "text_file": txt_fname,
        "size": os.path.getsize(bin_path),
        "uploaded": datetime.utcnow().isoformat() + "Z"
    })
    save_index(idx)

def delete_doc(doc_id: str) -> bool:
    idx = load_index()
    doc = next((d for d in idx if d["id"] == doc_id), None)
    if not doc:
        return False

    # remove both binary and text versions if present
    to_remove = {doc["file"]}
    if "text_file" in doc:
        to_remove.add(doc["text_file"])

    for fname in to_remove:
        try:
            os.remove(os.path.join(UPLOAD_DIR, fname))
        except FileNotFoundError:
            pass

    idx = [d for d in idx if d["id"] != doc_id]
    save_index(idx)
    return True

# ---------- personas ----------------------------------------------
def load_personas() -> dict:
    if not os.path.exists(PERSONA_FILE):
        with open(PERSONA_FILE, "w", encoding="utf-8") as f:
            json.dump({"Default": "You are a helpful business assistant."}, f, indent=2)
    with open(PERSONA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_personas(data: dict) -> None:
    with LOCK, open(PERSONA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

PERSONAS = load_personas()

# ---------- session helpers ---------------------------------------
def sid()       -> str:  return session.setdefault("sid", str(uuid.uuid4()))
def is_admin()  -> bool: return session.get("is_admin", False)

# ---------- combined FAQ text -------------------------------------
def combined_faq(limit_chars: int = 25000) -> str:
    txt = ""
    for doc in load_index():
        path = os.path.join(
            UPLOAD_DIR,
            doc.get("text_file", doc["file"])  # fallback for pre-upgrade rows
        )
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except FileNotFoundError:
            content = ""

        txt += f"\n--- {doc['name']} ---\n{content}"
        if len(txt) >= limit_chars:
            break
    return txt[:limit_chars]

# ==================================================================
# Flask routes
# ==================================================================

@app.route("/")
def index():
    return render_template("index.html")

# ---------- admin login ----------
@app.route("/admin/login", methods=["POST"])
def admin_login():
    if request.get_json(force=True).get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        return "", 204
    return "unauthorized", 401

# ---------- persona CRUD ----------
@app.route("/admin/personas", methods=["GET", "POST"])
def personas():
    if not is_admin():
        return "forbidden", 403

    if request.method == "GET":
        return jsonify(PERSONAS)

    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    instr = data.get("instructions", "").strip()
    if not name or not instr:
        return "bad request", 400

    PERSONAS[name] = instr
    save_personas(PERSONAS)
    return "", 204

@app.route("/admin/personas/<name>", methods=["DELETE"])
def persona_delete(name):
    if not is_admin():
        return "forbidden", 403
    if name == "Default":
        return "cannot delete default", 400
    PERSONAS.pop(name, None)
    save_personas(PERSONAS)
    return "", 204

# ---------- FAQ upload & list ----------
@app.route("/admin/upload", methods=["POST"])
def upload():
    if not is_admin():
        return "forbidden", 403
    files = request.files.getlist("files")
    if not files:
        return "no files", 400
    for f in files:
        add_doc(f)
    return "", 204

@app.route("/admin/faqs", methods=["GET"])
def list_faqs():
    if not is_admin():
        return "forbidden", 403
    return jsonify(load_index())

@app.route("/admin/faqs/<doc_id>", methods=["DELETE"])
def del_faq(doc_id):
    if not is_admin():
        return "forbidden", 403
    if delete_doc(doc_id):
        return "", 204
    return "not found", 404

# ---------- clear conversation (not FAQs) ----------
CONV_HISTORY: dict[str, list] = {}

@app.route("/admin/clear", methods=["POST"])
def clear_conv():
    if not is_admin():
        return "forbidden", 403
    CONV_HISTORY.pop(sid(), None)
    return "", 204

# ---------- chat endpoint ----------
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    question = data.get("message", "").strip()
    model = data.get("model", "gpt-4o")
    persona = PERSONAS.get(data.get("persona", "Default"), PERSONAS["Default"])
    temperature = float(data.get("temperature", 0.2))

    if not question:
        return jsonify(error="empty"), 400

    history = CONV_HISTORY.setdefault(sid(), [])
    history.append({"role": "user", "content": question})
    history = history[-20:]  # trim context

    sys_prompt = (
        f"{persona}\n\nWhen relevant, answer using these FAQs:\n```\n"
        f"{combined_faq()}\n```"
    )

    resp = openai.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": sys_prompt}, *history],
        temperature=temperature,
    )

    answer = resp.choices[0].message.content.strip()
    history.append({"role": "assistant", "content": answer})
    CONV_HISTORY[sid()] = history
    return jsonify(answer=answer)

# ---------- run ----------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)
