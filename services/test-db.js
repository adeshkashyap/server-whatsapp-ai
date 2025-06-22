const db = require('./db-mysql');

async function testConnection() {
  try {
    const [rows] = await db.query('SELECT');
    console.log(' Total:', rows[0].total);
  } catch (err) {
    console.error(' Database connection failed:', err.message);
  }
}

testConnection();
