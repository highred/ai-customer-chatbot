import os, uuid
from flask import Flask, request, jsonify, render_template, session
import openai

# ── keys & config ──────────────────────────────────────────────────
openai.api_key = os.getenv("OPENAI_API_KEY")
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

# in-memory store: {session_id: [ {"role": "...", "content": "..."} ]}
CONV_HISTORY = {}

# ── root page ──────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

# ── chat endpoint with memory ──────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    # ensure each browser gets a unique session_id cookie
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    sid = session["sid"]

    # pull question
    data = request.get_json(force=True)
    question = data.get("message", "").strip()
    if not question:
        return jsonify({"error": "empty message"}), 400

    # start / append history
    history = CONV_HISTORY.setdefault(sid, [])
    history.append({"role": "user", "content": question})
    # keep only last 10 exchanges to control token usage
    history = history[-20:]
    CONV_HISTORY[sid] = history

    # safety guard
    if not openai.api_key or openai.api_key.startswith("replace_with"):
        answer = "🛑 OpenAI key not set in .env"
    else:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=history,
            temperature=0.2,
        )
        answer = response.choices[0].message.content.strip()

    # add assistant reply to history
    history.append({"role": "assistant", "content": answer})
    CONV_HISTORY[sid] = history[-20:]

    return jsonify({"answer": answer})

# ── run locally ────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
