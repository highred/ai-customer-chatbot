import os, json, uuid, threading, pickle
from datetime import datetime
from typing import Dict, List

from flask import Flask, request, jsonify, render_template, session
from werkzeug.utils import secure_filename
import openai
from dotenv import load_dotenv
load_dotenv()

from PyPDF2 import PdfReader
from pdfminer.high_level import extract_text as pdfminer_text
import fitz
import docx
import pandas as pd

import numpy as np
from sqlalchemy import create_engine, Column, Integer, String, LargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker
from werkzeug.exceptions import HTTPException

openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")
LOCK = threading.Lock()

BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
UPLOAD_DIR   = os.path.join(BASE_DIR, "faq_uploads")
INDEX_FILE   = os.path.join(UPLOAD_DIR, "_index.json")
PERSONA_FILE = os.path.join(BASE_DIR, "personas.json")
os.makedirs(UPLOAD_DIR, exist_ok=True)

EMBED_MODEL = "text-embedding-3-small"
EMBED_COST_PER_KTOKENS = 0.0001
MAX_TOKENS_PER_CHUNK = 8192
MAX_CHARS_PER_CHUNK = 12000

ENG     = create_engine(f"sqlite:///{os.path.join(BASE_DIR,'faq_chunks.db')}")
Base    = declarative_base()
Session = sessionmaker(bind=ENG)

class Chunk(Base):
    __tablename__ = "chunks"
    id      = Column(Integer, primary_key=True)
    file_id = Column(String, index=True)
    text    = Column(String)
    emb     = Column(LargeBinary)

Base.metadata.create_all(ENG)

def handle_db(fn):
    def wrapped(*a, **kw):
        sess = Session()
        try: return fn(sess, *a, **kw)
        finally: sess.close()
    return wrapped

def embed(text):
    if len(text) > MAX_CHARS_PER_CHUNK:
        return None
    res = openai.embeddings.create(input=text, model=EMBED_MODEL)
    return np.array(res.data[0].embedding, dtype="float32")

@handle_db
def add_chunk(sess, file_id, text, embed_ok=True):
    vec = embed(text) if embed_ok else None
    if vec is not None:
        sess.add(Chunk(file_id=file_id, text=text, emb=pickle.dumps(vec)))
        sess.commit()
        return len(text), len(vec)
    return len(text), 0

@handle_db
def query_chunks(sess, q_emb, top_k=5):
    rows = sess.query(Chunk).all()
    if not rows: return []
    embs = np.vstack([pickle.loads(r.emb) for r in rows])
    sims = (embs @ q_emb).flatten()
    idxs = sims.argsort()[-top_k:][::-1]
    return [(rows[i].text, float(sims[i])) for i in idxs]

def extract_text(path, ext):
    try:
        if ext == ".txt":
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        if ext == ".pdf":
            txt = "\n".join(p.extract_text() or "" for p in PdfReader(path).pages[:10])
            if not txt.strip():
                txt = pdfminer_text(path, maxpages=10)
            if not txt.strip():
                with fitz.open(path) as doc:
                    txt = "\n".join(p.get_text() for p in doc[:10])
            return txt
        if ext == ".docx":
            d = docx.Document(path)
            return "\n".join(p.text for p in d.paragraphs[:300])
        if ext in (".xls", ".xlsx"):
            return pd.read_excel(path).to_csv(index=False)
    except Exception as e:
        print("Extraction failed:", e)
    return ""

def build_chunks(file_id, text, rows_per_chunk=50):
    lines = text.splitlines()
    if not lines: return {"chunks": 0, "skipped": 0, "token_est": 0}
    chunk_count, skipped, token_total = 0, 0, 0
    for i in range(0, len(lines), rows_per_chunk):
        chunk = "\n".join(lines[i:i+rows_per_chunk])
        embed_ok = len(chunk) < MAX_CHARS_PER_CHUNK
        chunk_len, emb_len = add_chunk(file_id, chunk, embed_ok=embed_ok)
        chunk_count += 1
        if emb_len == 0: skipped += 1
        token_total += int(chunk_len / 4)
    return {
        "chunks": chunk_count,
        "skipped": skipped,
        "token_est": token_total,
        "cost_est": round(token_total / 1000 * EMBED_COST_PER_KTOKENS, 6)
    }

def load_index():
    if not os.path.exists(INDEX_FILE): return []
    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_index(idx):
    with LOCK:
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            json.dump(idx, f, indent=2)

def add_doc(file_storage, rows_per_chunk=50):
    idx  = load_index()
    orig = secure_filename(file_storage.filename)
    ext  = os.path.splitext(orig)[1].lower()
    uid  = str(uuid.uuid4())
    bin_path = os.path.join(UPLOAD_DIR, f"{uid}{ext}")
    file_storage.save(bin_path)

    text = extract_text(bin_path, ext)
    txt_path = bin_path if ext == ".txt" else os.path.join(UPLOAD_DIR, f"{uid}.txt")
    if ext != ".txt":
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

    meta = {
        "id": uid, "name": orig,
        "file": os.path.basename(bin_path),
        "text_file": os.path.basename(txt_path),
        "size": os.path.getsize(bin_path),
        "uploaded": datetime.utcnow().isoformat() + "Z"
    }

    stats = build_chunks(uid, text, rows_per_chunk)
    meta.update(stats)

    idx.append(meta)
    save_index(idx)
    return meta

def delete_doc(doc_id):
    idx = load_index()
    doc = next((d for d in idx if d["id"] == doc_id), None)
    if not doc: return False
    for f in {doc["file"], doc.get("text_file", doc["file"])}:
        try: os.remove(os.path.join(UPLOAD_DIR, f))
        except: pass
    save_index([d for d in idx if d["id"] != doc_id])
    return True

def load_personas():
    if not os.path.exists(PERSONA_FILE):
        with open(PERSONA_FILE, "w", encoding="utf-8") as f:
            json.dump({"Default": "You are a helpful business assistant."}, f)
    with open(PERSONA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_personas(data):
    with LOCK:
        with open(PERSONA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

def combined_faq(limit=20000):
    txt = ""
    for doc in load_index():
        path = os.path.join(UPLOAD_DIR, doc.get("text_file", doc["file"]))
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except: content = ""
        txt += f"\n--- {doc['name']} ---\n{content}"
        if len(txt) > limit: break
    return txt[:limit]

def sid(): return session.setdefault("sid", str(uuid.uuid4()))
def is_admin(): return session.get("is_admin", False)

PERSONAS = load_personas()
CONV_HISTORY: Dict[str, List[Dict]] = {}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin/login", methods=["POST"])
def admin_login():
    if request.get_json(force=True).get("password") == os.getenv("ADMIN_PASSWORD", "changeme123"):
        session["is_admin"] = True
        return "", 204
    return "unauthorized", 401

@app.route("/admin/personas", methods=["GET", "POST"])
def personas():
    if not is_admin(): return "forbidden", 403
    if request.method == "GET":
        return jsonify(PERSONAS)
    data = request.get_json(force=True)
    name, txt = data.get("name", "").strip(), data.get("instructions", "").strip()
    if not name or not txt: return "bad request", 400
    PERSONAS[name] = txt
    save_personas(PERSONAS)
    return "", 204

@app.route("/admin/personas/<name>", methods=["DELETE"])
def delete_persona(name):
    if not is_admin(): return "forbidden", 403
    if name == "Default": return "can't delete default", 400
    PERSONAS.pop(name, None)
    save_personas(PERSONAS)
    return "", 204

@app.route("/admin/upload", methods=["POST"])
def admin_upload():
    if not is_admin(): return "forbidden", 403
    chunk_size = int(request.headers.get("X-Chunk-Size", "50"))
    stats = []
    for f in request.files.getlist("files"):
        result = add_doc(f, rows_per_chunk=chunk_size)
        stats.append(result)
    return jsonify(stats)

@app.route("/admin/faqs", methods=["GET"])
def list_docs():
    if not is_admin(): return "forbidden", 403
    return jsonify(load_index())

@app.route("/admin/faqs/<doc_id>", methods=["DELETE"])
def remove_doc(doc_id):
    if not is_admin(): return "forbidden", 403
    return ("", 204) if delete_doc(doc_id) else ("not found", 404)

@app.route("/admin/clear", methods=["POST"])
def clear_chat():
    if not is_admin(): return "forbidden", 403
    CONV_HISTORY.pop(sid(), None)
    return "", 204

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    message     = data.get("message", "").strip()
    model       = data.get("model", "gpt-4o")
    persona_key = data.get("persona", "Default")
    temp        = float(data.get("temperature", 0.2))

    if not message: return jsonify(error="empty"), 400
    if not openai.api_key: return jsonify(error="Missing OPENAI_API_KEY"), 500

    persona = PERSONAS.get(persona_key, PERSONAS["Default"])
    history = CONV_HISTORY.setdefault(sid(), [])
    history.append({ "role": "user", "content": message })
    history = history[-20:]

    q_emb      = embed(message)
    top_chunks = query_chunks(q_emb, top_k=5)
    chunk_txt  = "\n".join(f"---\n{t}" for t, _ in top_chunks)

    sys_prompt = (
        f"{persona}\n\nUse the following reference when helpful:\n"
        f"```\n{chunk_txt}\n{combined_faq()}\n```"
    )

    resp = openai.chat.completions.create(
        model=model,
        messages=[{ "role": "system", "content": sys_prompt }, *history],
        temperature=temp,
    )
    answer = resp.choices[0].message.content.strip()
    history.append({ "role": "assistant", "content": answer })
    CONV_HISTORY[sid()] = history
    return jsonify(answer=answer)

@app.errorhandler(Exception)
def handle_error(e):
    print("ERROR:", e)
    if isinstance(e, HTTPException):
        return jsonify(error=str(e)), e.code
    return jsonify(error=str(e)), 500

if __name__ == "__main__":
    app.run(debug=True)
