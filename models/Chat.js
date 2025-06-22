const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    phone: String,
    message: String,
    intent: Object,
    reply: String,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', ChatSchema);
