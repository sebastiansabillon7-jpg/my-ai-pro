const express = require("express");
const OpenAI = require("openai");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. Add it before using the AI.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const clean = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .slice(-40)
      .map(m => ({ role: m.role, content: String(m.content || "").slice(0, 20000) }));

    if (!clean.length) return res.status(400).json({ error: "No message supplied." });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      instructions: `You are the AI inside a polished personal assistant website.
Be helpful, accurate, clear, and friendly. Use headings and bullets when they improve readability.
If the user asks for code, provide complete usable code and explain important setup briefly.
Do not claim to have browsed the internet or performed actions you did not actually perform.`,
      input: clean
    });

    res.json({ reply: response.output_text || "I couldn't generate a response." });
  } catch (err) {
    console.error(err);
    const message = err?.status === 401
      ? "Your OpenAI API key is invalid or missing."
      : "The AI request failed. Check your server and API key.";
    res.status(500).json({ error: message });
  }
});
app.post("/api/image", async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "Please provide an image prompt." });
    }

    const result = await client.responses.create({
      model: "gpt-5.6-luna",
      input: prompt,
      tools: [
        {
          type: "image_generation",
          model: "gpt-image-2",
          size: "1024x1024"
        
        }
      ]
    });

    const imageCall = result.output.find(
      item => item.type === "image_generation_call"
    );

    if (!imageCall?.result) {
      return res.status(500).json({ error: "Image generation failed." });
    }

    res.json({
      image: `data:image/png;base64,${imageCall.result}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "The image generation request failed." });
  }
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => console.log(`My AI Pro is running at http://localhost:${port}`));
