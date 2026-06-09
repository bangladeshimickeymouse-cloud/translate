import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "public")));

app.post("/api/translate", async (req, res) => {
  const { message, room, user_name } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a translator. Detect whether the user's message is in Vietnamese or English. " +
            "If it's Vietnamese, translate it to English. If it's English, translate it to Vietnamese. " +
            "Respond with ONLY the translated text, nothing else.",
        },
        { role: "user", content: message },
      ],
    });

    const translated = completion.choices[0]?.message?.content?.trim();

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
    res.status(500).json({ error: "Translation service error" });
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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;

function detectLanguage(original, translated) {
  const viChars =
    /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i;
  if (viChars.test(original)) return "vi";
  if (viChars.test(translated)) return "en";
  return original.length < translated.length ? "en" : "vi";
}
