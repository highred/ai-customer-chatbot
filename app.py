import os, uuid, json, threading
from flask import Flask, request, jsonify, render_template, session
import openai

# --- config --------------------------------------------------------
openai.api_key   = os.getenv("OPENAI_API_KEY")
ADMIN_PASSWORD   = os.getenv("ADMIN_PASSWORD", "changeme123")
PERSONA_FILE     = "personas.json"
LOCK             = threading.Lock()

app              = Flask(__name__)
app.secret_key   = os.getenv("FLASK_SECRET_KEY", "dev-secret")

CONV_HISTORY = {}      # {sid: [msgs]}
FAQ_STORE    = {}      # {sid: faq_text}

# --- persona helpers ----------------------------------------------
def load_personas():
    if not os.path.exists(PERSONA_FILE):
        with open(PERSONA_FILE, "w") as f:
            json.dump({"Default": "You are a helpful business assistant."}, f, indent=2)
    with open(PERSONA_FILE, "r") as f:
        return json.load(f)

def save_personas(data):
    with LOCK, open(PERSONA_FILE, "w") as f:
        json.dump(data, f, indent=2)

PERSONAS = load_personas()

# --- convenience ---------------------------------------------------
def sid():       return session.setdefault("sid", str(uuid.uuid4()))
def is_admin():  return session.get("is_admin", False)

# --- routes --------------------------------------------------------
@app.route("/")
def index(): return render_template("index.html")

# -------- admin auth ----------
@app.route("/admin/login", methods=["POST"])
def admin_login():
    if request.get_json(force=True).get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        return "", 204
    return "unauthorized", 401

# -------- persona API ----------
@app.route("/admin/personas", methods=["GET","POST"])
def personas():
    if not is_admin(): return "forbidden", 403
    if request.method == "GET":
        return jsonify(PERSONAS)
    data = request.get_json(force=True)
    name, instr = data.get("name","").strip(), data.get("instructions","").strip()
    if not name or not instr: return "bad request", 400
    PERSONAS[name] = instr
    save_personas(PERSONAS)
    return "", 204

@app.route("/admin/personas/<name>", methods=["DELETE"])
def delete_persona(name):
    if not is_admin(): return "forbidden", 403
    if name == "Default": return "cannot delete default", 400
    PERSONAS.pop(name, None)
    save_personas(PERSONAS)
    return "", 204

# -------- faq upload ----------
@app.route("/upload", methods=["POST"])
def upload():
    if not is_admin(): return "forbidden", 403
    FAQ_STORE[sid()] = request.files["file"].read().decode("utf-8","ignore")
    return f"FAQ uploaded ({len(FAQ_STORE[sid()])} chars)", 200

# -------- clear session -------
@app.route("/admin/clear", methods=["POST"])
def clear():
    if not is_admin(): return "forbidden", 403
    CONV_HISTORY.pop(sid(), None); FAQ_STORE.pop(sid(), None)
    return "", 204

# -------- chat ----------
@app.route("/chat", methods=["POST"])
def chat():
    data      = request.get_json(force=True)
    question  = data.get("message","").strip()
    model     = data.get("model","gpt-4o")
    persona   = PERSONAS.get(data.get("persona","Default"), PERSONAS["Default"])
    if not question: return jsonify(error="empty"), 400

    history = CONV_HISTORY.setdefault(sid(), [])
    history.append({"role":"user","content":question})
    history = history[-20:]

    sys_prompt = f"{persona}\n\nWhen relevant, answer using this FAQ:\n```\n" \
                 + FAQ_STORE.get(sid(),"")[:4000] + "\n```"

    resp = openai.chat.completions.create(
              model=model,
              messages=[{"role":"system","content":sys_prompt}, *history],
              temperature=0.2)
    answer = resp.choices[0].message.content.strip()

    history.append({"role":"assistant","content":answer})
    CONV_HISTORY[sid()] = history
    return jsonify(answer=answer)

if __name__ == "__main__":
    app.run(debug=True)
