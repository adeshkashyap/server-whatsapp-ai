const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const patchDir = path.join(__dirname, '../../self-patches');
  try {
    const files = fs.readdirSync(patchDir).filter(f => f.endsWith('.json'));
    const patches = files.map(file => {
      const data = fs.readFileSync(path.join(patchDir, file), 'utf8');
      return JSON.parse(data);
    });
    res.json({ success: true, data: patches });
  } catch (err) {
    console.error('Failed to load patches:', err.message);
    res.status(500).json({ success: false, message: 'Could not read patch files.' });
  }
});

module.exports = router;
