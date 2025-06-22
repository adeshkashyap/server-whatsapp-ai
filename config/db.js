const mongoose = require('mongoose');
require('dotenv').config();
mongoose.set('debug', true);

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(" MONGODB_URI is undefined. Check your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(' Connected to MongoDB Atlas (Cloud)');
  } catch (err) {
    console.error(' MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
