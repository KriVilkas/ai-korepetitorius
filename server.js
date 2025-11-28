// server.js — FULL WORKING VERSION WITH FIREBASE MEMORY

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 🔥 Firebase connection
import { db } from "./firebase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Serve index.html
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔹 Load last N messages from Firestore
async function loadHistory(userId, limit = 10) {
  if (!userId) return [];

  const snap = await db
    .collection("users")
    .doc(userId)
    .collection("messages")
    .orderBy("time", "asc")
    .limitToLast(limit)
    .get();

  const history = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.role && d.content) {
      history.push({ role: d.role, content: d.content });
    }
  });

  return history;
}

// 🔹 Save a message into Firebase
async function saveMessage(userId, role, content) {
  if (!userId) return;

  await db
    .collection("users")
    .doc(userId)
    .collection("messages")
    .add({
      role,
      content,
      time: Date.now(),
    });
}

// 🔥 MAIN AI ENDPOINT — handles chat + memory
app.post("/ask", async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const mode = req.body.mode || "explain";
    const userId = req.body.userId;

    console.log("Incoming:", { userId, mode, userMessage });

    // 1. Load last messages (for memory)
    const history = await loadHistory(userId, 10);

    // 2. Mode-specific instructions
    const MODE_PROMPTS = {
      explain:
        "Tu esi kantrus korepetitorius. Aiškink paprastai, žingsnis po žingsnio, trumpai ir aiškiai.",
      problems:
        "Tu duodi vieną uždavinį vienu metu. Nepateik pilno sprendimo, nebent mokinys paprašo.",
      check:
        "Tu tikrini mokinio sprendimus. Surask klaidas, paaiškink logiką ir pasiūlyk pataisymus.",
    };

    const systemPrompt =
      MODE_PROMPTS[mode] || MODE_PROMPTS["explain"];

    // 3. Construct conversation sent to OpenAI
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    // 4. Call OpenAI API
    const resp = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 600,
        }),
      }
    );

    const data = await resp.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      "Atsakymas nerastas.";

    // 5. Save both user and assistant messages
    await saveMessage(userId, "user", userMessage);
    await saveMessage(userId, "assistant", reply);

    // 6. Respond to frontend
    return res.json({ reply });
  } catch (err) {
    console.error("❌ Error in /ask:", err);
    return res
      .status(500)
      .json({ reply: "Serverio klaida. Bandyk dar kartą." });
  }
});

// 🔥 NEW: Return full chat history for this user
app.post("/history", async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res.json({ history: [] });
    }

    const snap = await db
      .collection("users")
      .doc(userId)
      .collection("messages")
      .orderBy("time", "asc")
      .get();

    const messages = [];
    snap.forEach((doc) => {
      const d = doc.data();
      messages.push({
        role: d.role,
        content: d.content,
      });
    });

    return res.json({ history: messages });
  } catch (err) {
    console.error("❌ Error in /history:", err);
    return res.json({ history: [] });
  }
});

// Start server
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
