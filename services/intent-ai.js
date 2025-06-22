const OpenAI = require("openai");
const IntentKeyword = require('../models/IntentKeyword');
const UserMemory = require("../models/UserMemory");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const persona = JSON.parse(
  fs.readFileSync(path.join(__dirname, "persona.json"), "utf8")
);

function normalize(text) {
  return text?.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
}

function isFollowUpQuery(text) {
  const phrases = [
    "anything else", "got more", "anything better", "what else", "more listings", "more options", "show more", "next one", "not satisfied", "retry"
  ];
  const lower = normalize(text);
  return phrases.some(p => lower.includes(p));
}

function updatePreferences(oldPrefs, newIntent) {
  return {
    bhk: newIntent.bhk || oldPrefs.bhk || "",
    location: newIntent.location || oldPrefs.location || "",
    budget: newIntent.budget || oldPrefs.budget || 0,
    type: newIntent.type || oldPrefs.type || "",
    sort: newIntent.sort || oldPrefs.sort || ""
  };
}

function suggestSelfPatch(context, suggestion, patchText, file = "intent-ai.js") {
  const patch = {
    timestamp: new Date().toISOString(),
    context,
    suggestion,
    targetFile: file,
    proposedPatch: patchText
  };

  const patchPath = path.join(__dirname, "self-patches", `patch-${Date.now()}.json`);
  fs.writeFileSync(patchPath, JSON.stringify(patch, null, 2), "utf8");
  console.log("💡 AI patch suggestion saved:", patchPath);
}

async function extractIntentAI(message, phone = null, pushname = null) {
  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
      ? "Good afternoon"
      : "Good evening";

  let memoryNote = "";
  let memory = null;

  if (phone) {
    memory = await UserMemory.findOne({ phone });
    if (!memory) {
      memory = await UserMemory.create({ phone, pushname, updatedAt: new Date() });
    } else if (pushname && memory.pushname !== pushname) {
      memory.pushname = pushname;
      await memory.save();
    }

    if (memory?.lastIntent) {
      const { bhk, location, budget, type } = memory.lastIntent;
      memoryNote = `
The user previously searched for a property:
- ${bhk ? `${bhk} BHK` : "any BHK"}
- in ${location || "any location"}
- under ₹${budget || "any budget"}
- for ${type || "rent or sale"}

If appropriate, you can politely refer to this context in your reply.`;
    }
  }

  if (isFollowUpQuery(message) && memory?.lastIntent) {
    return {
      intent: "search",
      reply: "",
      bhk: memory.lastIntent.bhk || "",
      location: memory.lastIntent.location || "",
      budget: memory.lastIntent.budget || 0,
      type: memory.lastIntent.type || "",
      sort: memory.lastIntent.sort || ""
    };
  }

  const personaIntro = `
You are "${persona.name}", a digital assistant created by adesh kumar.

Traits: ${persona.traits.join(", ")}
Abilities: ${persona.abilities.join(", ")}
Limitations: ${persona.limitations.join(", ")}
Identity: ${persona.identity}
`;

  const prompt = `
${personaIntro}
${memoryNote}

If the user's name is known, use it in replies. Here it is: ${pushname || "(unknown)"}
 If the message is casual or not a search query (e.g., "hi", "how are you?"):
- Set intent = "chat"
- Generate a short and friendly reply that includes the user's name if available
Here’s the user message:
"${message}"`;

  let parsed;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are Shree AI. Start replies with "${timeGreeting} " if it's a chat.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    });

    const raw = chatCompletion.choices[0].message.content.trim();
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("OpenAI error or JSON parse fail:", err);
    return {
      intent: "chat",
      reply: " Sorry, I couldn't understand that. Could you rephrase?",
    };
  }

  const normalizedText = normalize(message);
  const keywordDocs = await IntentKeyword.find({});

  for (const doc of keywordDocs) {
    for (const keyword of doc.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        if (!parsed[doc.mappedField]) {
          parsed.intent = doc.intentType || parsed.intent;
          parsed[doc.mappedField] = doc.mappedValue;
          console.log(`Keyword match: "${keyword}" → ${doc.mappedField} = ${doc.mappedValue}`);
        }
      }
    }
  }

  if (parsed.intent === "chat" && phone) {
    if (pushname && parsed.reply) {
      parsed.reply = parsed.reply.replace(/\b(hi|hello|hey|greetings)(\b|!|\s)/i, `$1 ${pushname}$2 `);
    }
  }

  if (parsed.reply) {
    parsed.reply = parsed.reply.replace(/chatgpt|openai/gi, persona.name);
  }

  if (parsed.intent === "search" && phone) {
    const preferences = updatePreferences(memory?.preferences || {}, parsed);
    await UserMemory.findOneAndUpdate(
      { phone },
      { preferences, lastIntent: parsed, updatedAt: new Date(), pushname },
      { upsert: true }
    );
  }

 
  if (parsed.intent === "chat" && message.toLowerCase().includes("budget") && !parsed.reply.includes("₹")) {
    suggestSelfPatch(
      message,
      "Detected missing budget in reply to budget-related query.",
      "Consider updating response logic to better include price ranges in casual replies."
    );
  }

  return parsed;
}

module.exports = {
  extractIntentAI,
};