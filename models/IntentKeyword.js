const mongoose = require('mongoose');

const IntentKeywordSchema = new mongoose.Schema({
  keywords: [String],                  // All keywords/phrases like ["buy", "purchasing"]
  intentType: { type: String },        // e.g., "search"
  mappedField: { type: String },       // e.g., "type"
  mappedValue: { type: String },       // e.g., "sale" or "rent"
  meaning: { type: String },           // Human-readable purpose like "Looking to purchase property"
  weight: { type: Number, default: 1 } // Optional for future NLP scoring
}, { timestamps: true });

module.exports = mongoose.model('IntentKeyword', IntentKeywordSchema);
