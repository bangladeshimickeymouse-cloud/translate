import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/debug", (req, res) => {
  res.json({
    has_deepseek_key: !!process.env.DEEPSEEK_API_KEY,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_anon: !!process.env.SUPABASE_ANON_KEY,
    node_version: process.version,
  });
});

app.post("/api/translate", async (req, res) => {
  const { message, room, user_name } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a translator between Vietnamese and English. " +
              "Translate the user's message. If it's English, output Vietnamese. If it's Vietnamese, output English. " +
              "Use correct Unicode for Vietnamese characters (à, á, ả, ã, ạ, ă, â, đ, ê, ô, ơ, ư, etc.). " +
              "Output ONLY the translated text with no explanation.",
          },
          { role: "user", content: message },
        ],
      }),
    });

    const raw = Buffer.from(await response.arrayBuffer());
    let text = raw.toString("utf8");
    if (text.includes("\uFFFD")) {
      text = raw.toString("latin1");
    }
    const data = JSON.parse(text);

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Translation failed" });
    }

    const translated = data.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      return res.status(500).json({ error: "Translation failed" });
    }

    const source_lang = detectLanguage(message, translated);

    if (room && user_name) {
      await supabase.from("messages").insert({
        room,
        user_name,
        original_text: message,
        translated_text: translated,
        source_lang,
      });
    }

    res.json({ original: message, translated, source_lang });
  } catch (err) {
    console.error("DeepSeek API error:", err);
    res.status(500).json({ error: err.message || "Translation service error" });
  }
});

app.get("/api/messages", async (req, res) => {
  const { room = "default" } = req.query;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room", room)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

export default app;

function detectLanguage(original, translated) {
  const viChars =
    /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i;
  if (viChars.test(original)) return "vi";
  if (viChars.test(translated)) return "en";
  return original.length < translated.length ? "en" : "vi";
}
