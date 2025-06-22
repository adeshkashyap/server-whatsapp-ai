// models/IntentLocation.js

const mongoose = require('mongoose');

const IntentLocationSchema = new mongoose.Schema({
  keywords: [String],              // Synonyms, misspellings, variations like ['indirapuram', 'indrapuram', 'इंद्रापुरम']
  mappedValue: String,             // Standard location name like "Indirapuram"
  meaning: String,                 // Optional: for better context (e.g., "Known residential area near Noida")
  active: { type: Boolean, default: true } // You can soft-disable locations without deleting them
}, { timestamps: true });

module.exports = mongoose.model('IntentLocation', IntentLocationSchema);
