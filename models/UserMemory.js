const mongoose = require('mongoose');

const userMemorySchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  pushname: { type: String },
  lastIntent: { type: Object },
  updatedAt: { type: Date, default: Date.now },
  awaitingNameUpdate: { type: Boolean, default: false },
});

module.exports = mongoose.model('UserMemory', userMemorySchema);
