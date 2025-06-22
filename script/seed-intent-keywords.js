
const mongoose = require('mongoose');
const IntentKeyword = require('./models/IntentKeyword');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const seedKeywords = async () => {
  try {
    await IntentKeyword.deleteMany();

    await IntentKeyword.insertMany([
      {
        keywords: ['buy', 'buying', 'purchase', 'purchasing', 'sale', 'selling'],
        intentType: 'search',
        mappedField: 'type',
        mappedValue: 'sale',
        meaning: 'User is interested in buying a property',
      },
      {
        keywords: ['rent', 'rental', 'for rent', 'lease', 'leasing'],
        intentType: 'search',
        mappedField: 'type',
        mappedValue: 'rent',
        meaning: 'User is looking to rent a property',
      }
    ]);

    console.log(' Keywords seeded successfully!');
  } catch (err) {
    console.error(' Error seeding keywords:', err);
  } finally {
    mongoose.disconnect();
  }
};

seedKeywords();
