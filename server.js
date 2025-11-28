// server.js — FINAL FULL VERSION

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./firebase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Load history from Firebase
async function loadHistory(userId, limit = 50) {
  if (!userId) return [];

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("messages")
    .orderBy("time", "asc")
    .limit(limit)
    .get();

  const history = [];
  snap.forEach(doc => {
    const d = doc.data();
    history.push({ role: d.role, content: d.content });
  });

  return history;
}

// Save message to Firebase
async function saveMessage(userId, role, content) {
  if (!userId) return;

  await db.collection("users")
    .doc(userId)
    .collection("messages")
    .add({
      role,
      content,
      time: Date.now(),
    });
}

// --- AI Chat Endpoint ---
app.post("/ask", async (req, res) => {
  try {
    const { message, mode, userId } = req.body;

    const history = await loadHistory(userId);

    const MODE_PROMPTS = {
      explain: "Tu esi kantrus korepetitorius. Aiškink paprastai.",
      problems: "Duok vieną uždavinį vienu metu, nespręsk už mokinį.",
      check: "Analizuok sprendimą, rask klaidas, paaiškink kur logika neteisinga."
    };

    const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.explain;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message }
    ];

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 600
      })
    });

    const data = await apiRes.json();
    const reply = data?.choices?.[0]?.message?.content || "Atsakymas nerastas.";

    await saveMessage(userId, "user", message);
    await saveMessage(userId, "assistant", reply);

    res.json({ reply });
  } catch (err) {
    console.error("ASK error:", err);
    res.status(500).json({ reply: "Serverio klaida." });
  }
});

// --- History Endpoint ---
app.post("/history", async (req, res) => {
  try {
    const { userId } = req.body;
    const history = await loadHistory(userId);
    res.json({ history });
  } catch (err) {
    console.error("History error:", err);
    res.json({ history: [] });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
