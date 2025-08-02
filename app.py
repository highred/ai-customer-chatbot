import os
from flask import Flask, jsonify, request
import openai

# ── load secrets ───────────────────────────────────────────────────
openai.api_key = os.getenv("OPENAI_API_KEY")  # reads from .env

app = Flask(__name__)

# ── health check route ─────────────────────────────────────────────
@app.route("/")
def hello():
    return jsonify({"msg": "Chatbot backend is alive"})

# ── new chat route ─────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    question = data.get("message", "").strip()

    if not question:
        return jsonify({"error": "empty message"}), 400

    # guard if key not set yet
    if not openai.api_key or openai.api_key.startswith("replace_with"):
        return jsonify({"answer": "🛑 OpenAI key not set in .env"}), 200

    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": question}],
        temperature=0.2,
    )
    answer = resp.choices[0].message.content.strip()
    return jsonify({"answer": answer})

# ── run locally ────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)
