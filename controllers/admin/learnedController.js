const LearnedResponse = require('../../models/LearnedResponse');

exports.getLearnedResponses = async (req, res) => {
  try {
    const responses = await LearnedResponse.find().sort({ updatedAt: -1 }).limit(100);
    res.json({ success: true, data: responses });
  } catch (error) {
    console.error('Error fetching learned responses:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch learned responses' });
  }
};
