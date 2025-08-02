import os, uuid
from flask import Flask, request, jsonify, render_template, session
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme123")

app            = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

CONV_HISTORY = {}   # {sid: [msgs]}
FAQ_STORE    = {}   # {sid: faq_text}

DEFAULT_INSTRUCT = """\
You are **"K.E.N.N" – Kenn Enhanced Neural Network**, the business-professional assistant \
for an ISO/IEC 17025-accredited calibration laboratory near Chicago.

**Core style guidelines**
• Accuracy first – cite ISO/IEC 17025 clause numbers where helpful.  
• Clear, concise answers – headline sentence, then short paragraphs or numbered bullets.  
• Risk-based mindset – note uncertainty budgets, corrective actions, customer impact.  
• Tone – warm, direct, seasoned quality-manager voice.  
• Visuals – suggest charts / code / formulas only when they add clear value; avoid tables unless essential.  
• Dates – default to U.S. Central Time.

Finish responses with an actionable takeaway when appropriate.
"""

# ── helpers ────────────────────────────────────────────────────────
def sid(): return session.setdefault("sid", str(uuid.uuid4()))
def is_admin(): return session.get("is_admin", False)
def get_instructions(payload):  # admin may pass custom instructions
    custom = payload.get("instructions", "").strip()
    return custom if custom else DEFAULT_INSTRUCT

# ── routes ─────────────────────────────────────────────────────────
@app.route("/")
def index(): return render_template("index.html")

@app.route("/admin/login", methods=["POST"])
def admin_login():
    if request.get_json(force=True).get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        return "", 204
    return "unauthorized", 401

@app.route("/upload", methods=["POST"])
def upload():
    if not is_admin(): return "forbidden", 403
    FAQ_STORE[sid()] = request.files["file"].read().decode("utf-8","ignore")
    return f"FAQ uploaded ({len(FAQ_STORE[sid()])} chars)", 200

@app.route("/admin/clear", methods=["POST"])
def clear():   # wipe convo + FAQ for this sid
    if not is_admin(): return "forbidden", 403
    CONV_HISTORY.pop(sid(), None); FAQ_STORE.pop(sid(), None)
    return "", 204

@app.route("/chat", methods=["POST"])
def chat():
    data      = request.get_json(force=True)
    question  = data.get("message","").strip()
    model     = data.get("model","gpt-4o")
    instruct  = get_instructions(data)
    if not question: return jsonify(error="empty"), 400

    history = CONV_HISTORY.setdefault(sid(), [])
    history.append({"role":"user","content":question})
    history = history[-20:]

    sys_prompt = f"{instruct}\n\nWhen relevant, answer using this FAQ:\n```\n" \
                 + FAQ_STORE.get(sid(),"")[:4000] + "\n```"

    messages  = [{"role":"system","content":sys_prompt}, *history]
    response  = openai.chat.completions.create(
                   model=model, messages=messages, temperature=0.2)
    answer    = response.choices[0].message.content.strip()

    history.append({"role":"assistant","content":answer})
    CONV_HISTORY[sid()] = history
    return jsonify(answer=answer)

if __name__ == "__main__":
    app.run(debug=True)
