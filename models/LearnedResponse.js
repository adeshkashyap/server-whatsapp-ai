
const mongoose = require('mongoose');

const LearnedResponseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  normalizedInput: { type: String, required: true, index: true },
  originalResponse: { type: String, required: true },
  finalResponse: { type: String, required: true },
  response: { type: String, required: true },
  intent: { type: Object, default: null },
  phone: { type: String, default: null },
  source: { type: String, enum: ['gpt', 'rewritten', 'manual'], default: 'gpt' },
  feedback: { type: String, enum: ['up', 'down', null], default: null },
  feedbackMessageId: { type: String, default: null },
  feedbackReceivedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LearnedResponse', LearnedResponseSchema);
