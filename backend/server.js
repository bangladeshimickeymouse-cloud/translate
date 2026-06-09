import express from "express";
import cors from "cors";
import OpenAI from "openai";
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

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.post("/api/translate", async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
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

    res.json({ original: message, translated });
  } catch (err) {
    console.error("DeepSeek API error:", err);
    res.status(500).json({ error: "Translation service error" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
