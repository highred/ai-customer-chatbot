import os, uuid
from flask import Flask, request, jsonify, render_template, session
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")
app            = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

CONV_HISTORY = {}   # {sid: [msgs]}
FAQ_STORE    = {}   # {sid: faq_text}

# ── root ───────────────────────────────────────────────────────────
@app.route("/")
def index(): return render_template("index.html")

# ── upload faq ─────────────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload():
    sid = session.setdefault("sid", str(uuid.uuid4()))
    file = request.files.get("file")
    if not file: return "No file",400
    FAQ_STORE[sid] = file.read().decode("utf-8","ignore")
    return f"FAQ uploaded ({len(FAQ_STORE[sid])} chars)",200

# ── chat ───────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    sid = session.setdefault("sid", str(uuid.uuid4()))
    data = request.get_json(force=True)
    question = data.get("message","").strip()
    model    = data.get("model","gpt-4o")
    if not question: return jsonify(error="empty"),400

    history = CONV_HISTORY.setdefault(sid, [])
    history.append({"role":"user","content":question})
    history = history[-20:]

    sys_prompt = (
        "You are a helpful support bot. "
        "When relevant, answer using this FAQ:\n```\n"
        + FAQ_STORE.get(sid,"")[:4000] + "\n```"
    )
    messages  = [{"role":"system","content":sys_prompt}, *history]
    resp      = openai.chat.completions.create(
                    model=model, messages=messages, temperature=0.2)
    answer    = resp.choices[0].message.content.strip()

    history.append({"role":"assistant","content":answer})
    CONV_HISTORY[sid] = history
    return jsonify(answer=answer)

if __name__=="__main__": app.run(debug=True)
