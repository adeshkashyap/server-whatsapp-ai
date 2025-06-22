const Chat = require('../../models/Chat');

// GET /api/admin/chats
exports.getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find().sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: chats });
  } catch (error) {
    console.error('Error fetching chats:', error.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve chat history' });
  }
};
