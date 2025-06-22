const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const OpenAI = require("openai");
const LearnedResponse = require("./models/LearnedResponse");
const connectDB = require("./db");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function train() {
  await connectDB();
  console.log("Starting self-training...");

  const samples = await LearnedResponse.find({
    $or: [
      { feedback: 'down' },
      { feedback: { $exists: false } }
    ]
  }).sort({ updatedAt: -1 }).limit(10);

  for (const sample of samples) {
    const prompt = `


User Message: "${sample.input}"
Current Reply: "${sample.finalResponse}"
Feedback: ${sample.feedback || "(none)"}

💡 Rewrite the reply to sound more helpful, natural, and knowledgeable. Keep it under 3 lines.
Return ONLY the improved reply in plain text.`;

    try {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful AI assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      });

      const improved = chatCompletion.choices[0].message.content.trim();
      if (improved && improved !== sample.finalResponse) {
        sample.originalResponse = sample.finalResponse;
        sample.finalResponse = improved;
        sample.response = improved;
        sample.feedback = null;
        sample.feedbackReceivedAt = null;
        sample.updatedAt = new Date();
        await sample.save();

        console.log("Improved and saved:", sample.input);
        console.log("New Reply:", improved);
      }
    } catch (err) {
      console.error("training failed:", err.message);
    }
  }

  console.log("🏁 Self-training complete.");
  process.exit(0);
}

train();
