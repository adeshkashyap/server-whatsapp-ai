const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log(' Starting WhatsApp Web Client with RemoteAuth...');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB Atlas');
    const store = new MongoStore({ mongoose });
    global.latestQR = null;
    const client = new Client({
      authStrategy: new RemoteAuth({
        store,
        clientId: 'whatsapp-client-01',
        backupPath: null,
        backupSyncIntervalMs: 60000,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    // 5. Events
    client.on('qr', (qr) => {
      console.log('📱 Scan this QR Code with WhatsApp:');
      qrcode.generate(qr, { small: true });

      global.latestQR = qr;
      try {
        fs.writeFileSync(path.join(__dirname, 'frontend', 'qr.txt'), qr);
      } catch (err) {
        console.warn(' Could not write QR to file:', err.message);
      }
    });

    client.on('ready', () => {
      console.log(' WhatsApp is connected and ready!');
      global.latestQR = null;
    });

    client.on('remote_session_saved', () => {
      console.log(' Remote session saved to MongoDB');
    });

    client.on('auth_failure', (msg) => {
      console.error(' Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
      console.warn(' WhatsApp disconnected:', reason);
    });

    await client.initialize();

  } catch (error) {
    console.error(' Error starting WhatsApp client:', error.message);
  }
})();
