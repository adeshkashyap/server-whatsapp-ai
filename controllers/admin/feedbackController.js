const LearnedResponse = require('../../models/LearnedResponse');

exports.getFeedback = async (req, res) => {
  try {
    const feedbackResponses = await LearnedResponse.find({ feedback: { $exists: true } }).sort({ updatedAt: -1 }).limit(100);
    res.json({ success: true, data: feedbackResponses });
  } catch (error) {
    console.error('Error fetching feedback:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
};
