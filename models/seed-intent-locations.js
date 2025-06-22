
const mongoose = require('mongoose');
const IntentLocation = require('./IntentLocation');
require('dotenv').config({ path: __dirname + '/../.env' });

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedLocations = async () => {
  await IntentLocation.deleteMany({});

  await IntentLocation.insertMany([
    {
      keywords: ['indirapuram', 'इंदिरापुरम'],
      mappedValue: 'Indirapuram',
      meaning: 'Popular residential area in Ghaziabad',
    },
    {
      keywords: ['niti khand', 'नीति खंड', 'niti khand 1', 'niti khand 2'],
      mappedValue: 'Niti Khand',
      meaning: 'Sector of Indirapuram with 1, 2 blocks',
    },
    {
      keywords: ['shakti khand', 'शक्ति खंड'],
      mappedValue: 'Shakti Khand',
      meaning: 'Another block in Indirapuram',
    },
    {
      keywords: ['gyan khand'],
      mappedValue: 'Gyan Khand',
      meaning: 'Nearby educational and residential area',
    },
    {
      keywords: ['vaishali'],
      mappedValue: 'Vaishali',
      meaning: 'Metro-connected residential zone',
    },
    {
      keywords: ['vasundhara'],
      mappedValue: 'Vasundhara',
      meaning: 'Residential area next to Vaishali',
    }
  ]);

  console.log(' Location keywords seeded successfully!');
  mongoose.disconnect();
};

seedLocations();
