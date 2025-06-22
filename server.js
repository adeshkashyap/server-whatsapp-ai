// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();
const open = (...args) => import('open').then(mod => mod.default(...args));


const selfUpdater = require('./utils/self-updater');
selfUpdater.run();

const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const connectDB = require('./config/db');
const adminAuthRoutes = require('./routes/admin/auth');
const createAdminRoutes = require('./routes/adminRoutes');
const verifyCookieToken = require('./middleware/verifyCookieToken');
const { initWebSocket, broadcastQR, broadcastStatus } = require('./ws/websocket-server');


const patchRoutes = require('./routes/admin/patches');
const Chat = require('./models/Chat');
const UserMemory = require('./models/UserMemory');
const LearnedResponse = require('./models/LearnedResponse');
const { extractIntentAI } = require('./services/intent-ai');
const { searchProducts } = require('./services/products');
const app = express();
const httpServer = require('http').createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set('verifyToken', verifyCookieToken);

let client;
let mongoStore;
let qrCode = null;
let isWhatsAppConnected = false;
let connectedNumber = null;
let isClientInitialized = false;

const normalizeInput = str => str.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
const buildSummary = (intent) => {
  const bhk = Array.isArray(intent.bhk) ? intent.bhk.join(', ') : (intent.bhk || 'Any');
  const location = intent.location || 'Any';
  const budget = intent.budget > 0 ? `₹${intent.budget}` : 'Any';
  const type = intent.type ? intent.type.charAt(0).toUpperCase() + intent.type.slice(1) : 'Any';
  return `*Search Summary:*\n Location: ${location}\n BHK: ${bhk}\n Budget: ${budget}\n Type: ${type}\n`;
};

const createClient = async () => {
  if (client) {
    console.log(' Destroying previous WhatsApp client...');
    try {
      await client.destroy();
    } catch (e) {
      console.warn(' WhatsApp client already destroyed:', e.message);
    }
    client = null;
    isClientInitialized = false;
  }

  try {
    mongoStore = new MongoStore({ mongoose });

   client = new Client({
  authStrategy: new RemoteAuth({
    store: mongoStore,
    backupSyncIntervalMs: 300000,
    backupPath: null,
    clientId: 'whatsapp-client-01',
  }),
  puppeteer: {
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
});


    client.on('qr', (qr) => {
      console.log('📲 QR Code received');
      qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      isWhatsAppConnected = false;
      connectedNumber = null;
      broadcastQR(qrCode);
      broadcastStatus({ connected: false });
    });

    client.on('ready', () => {
      console.log('WhatsApp connected');
      qrCode = null;
      isWhatsAppConnected = true;
      connectedNumber = client.info?.wid?.user || null;
      broadcastStatus({ connected: true, number: connectedNumber });
    });

    client.on('auth_failure', (msg) => {
      console.error(' WhatsApp auth failed:', msg);
      isWhatsAppConnected = false;
      connectedNumber = null;
      broadcastStatus({ connected: false });
    });

    client.on('disconnected', async (reason) => {
      console.warn('🔌 WhatsApp disconnected:', reason);
      try {
        await client.destroy();
        if (mongoStore) {
          await mongoStore.delete({ clientId: 'whatsapp-client-01' });
          console.log('🧹 RemoteAuth session removed');
        }
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr.message);
      }

      isWhatsAppConnected = false;
      connectedNumber = null;
      qrCode = null;
      isClientInitialized = false;
      broadcastStatus({ connected: false });

      console.log('Reinitializing...');
      setTimeout(() => createClient(), 2000);
    });

   client.on('message', async (message) => {
  const rawMessage = message.body?.trim();
  if (!rawMessage) {
    console.warn(`Skipping ${message.from}`);
    return;
  }

  const lowerBody = rawMessage.toLowerCase();
  const contact = await message.getContact();
  const pushname = contact.pushname || contact.name || 'there';
  const normalizedInput = normalizeInput(rawMessage);

  console.log(` ${message.from} (${pushname}): ${rawMessage}`);

  if (["yes", "no"].includes(lowerBody)) {
    const recent = await LearnedResponse.findOne({ phone: message.from }).sort({ createdAt: -1 });
    if (recent) {
      recent.feedback = lowerBody === 'yes' ? 'up' : 'down';
      recent.feedbackReceivedAt = new Date();
      await recent.save();
      return client.sendMessage(message.from,
        lowerBody === 'yes'
          ? 'Glad you’re happy! Let me know if you need anything else.'
          : 'Sorry about that. I’ll keep learning to serve you better.'
      );
    }
    return client.sendMessage(message.from, 'No recent response to attach feedback to.');
  }

  let memory = await UserMemory.findOne({ phone: message.from });
  if (!memory) {
    memory = await UserMemory.create({ phone: message.from, pushname, platform: client.info?.platform || '', updatedAt: new Date() });
  } else if (memory.pushname !== pushname) {
    memory.pushname = pushname;
    await memory.save();
  }

  let learned = await LearnedResponse.findOne({ normalizedInput });
  const shouldRefresh = learned && learned.source === 'gpt' && !learned.feedback;
  if (shouldRefresh) learned = null;

  let intent, reply, originalResponse, finalResponse;

  if (learned) {
    intent = learned.intent || { intent: 'chat' };
    originalResponse = learned.originalResponse;
    finalResponse = learned.finalResponse;
    reply = finalResponse;
  } else {
    try {
      intent = await extractIntentAI(rawMessage, message.from, pushname);
    } catch (err) {
     
      return client.sendMessage(message.from, `Sorry *${pushname}*, I couldn't understand that. Could you rephrase?`);
    }

    if (intent.intent === 'chat') {
      originalResponse = intent.reply || `How can I assist you today, *${pushname}*?`;
    } else if (intent.intent === 'search') {
      if (memory.lastIntent) {
        intent.bhk = intent.bhk || memory.lastIntent.bhk;
        intent.location = intent.location || memory.lastIntent.location;
        intent.budget = intent.budget || memory.lastIntent.budget;
        intent.type = intent.type || memory.lastIntent.type;
      }

      const { results, message: fallback } = await searchProducts(intent);
      if (results.length > 0) {
        originalResponse = buildSummary(intent);
        results.forEach((p, i) => {
          originalResponse += `\n${i + 1}. ${p.bhk || ''}BHK ${p.name} in ${p.location || 'N/A'}\nPrice: ₹${p.price}\nLink: ${p.link}\n`;
        });
        await UserMemory.findOneAndUpdate({ phone: message.from }, { lastIntent: intent, updatedAt: new Date() });
      } else {
        originalResponse = fallback;
      }
    } else {
      originalResponse = `Please provide location, BHK, budget, or rent/sale so I can help you, *${pushname}*.`;
    }

    finalResponse = originalResponse;
    reply = finalResponse;

    // Save learned response only if input is valid
    if (rawMessage && normalizedInput) {
      await LearnedResponse.create({
        input: rawMessage,
        normalizedInput,
        originalResponse,
        finalResponse,
        response: finalResponse,
        intent,
        phone: message.from,
        source: 'gpt',
        feedback: null,
      });
    }
  }

  await Chat.create({ phone: message.from, message: rawMessage, intent, reply });
  await client.sendMessage(message.from, reply);

  if (!learned && intent.intent !== 'chat') {
    await client.sendMessage(message.from, `*Are you satisfied with my reply?*\nType *Yes* if satisfied, or *No* if not.`);
  }
});


    await client.initialize();
    isClientInitialized = true;
  } catch (err) {
    console.error(' Failed to initialize WhatsApp client:', err.message);
  }
};

app.get('/api/whatsapp-status', verifyCookieToken, (req, res) => {
  res.json({ connected: isWhatsAppConnected, number: connectedNumber, message: isWhatsAppConnected ? `WhatsApp is connected (${connectedNumber})` : 'Waiting for WhatsApp connection...', qr: !isWhatsAppConnected ? qrCode : null });
});

app.get('/api/whatsapp-connect', verifyCookieToken, async (req, res) => {
  try {
    if (!client || !isWhatsAppConnected) await createClient();
    if (qrCode) return res.json({ qr: qrCode });
    if (isWhatsAppConnected) return res.json({ connected: true, number: connectedNumber });
    return res.status(400).json({ message: 'QR not available or already connected' });
  } catch (err) {
    console.error(' WhatsApp Connect Error:', err.message);
    res.status(500).json({ message: 'Failed to initialize WhatsApp' });
  }
});

app.post('/api/whatsapp-logout', verifyCookieToken, async (req, res) => {
  try {
    if (client) {
      await client.logout();
      await client.destroy();
    }
    if (mongoStore) await mongoStore.delete({ clientId: 'whatsapp-client-01' });
    isWhatsAppConnected = false;
    connectedNumber = null;
    qrCode = null;
    isClientInitialized = false;
    broadcastStatus({ connected: false });
    res.json({ message: 'WhatsApp session logged out' });
  } catch (err) {
    console.error('Logout Error:', err.message);
    res.status(500).json({ message: 'Logout failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server healthy' });
});

app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/patches', verifyCookieToken, patchRoutes); // PATCHES API
app.use('/api', createAdminRoutes(app));

const frontendPath = path.join(__dirname, 'frontend', 'admin-react', 'build');
if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
  app.use(express.static(frontendPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        console.error('Frontend load error:', err.message);
        res.status(500).send('Failed to load frontend');
      }
    });
  });
} else {
  console.warn(' React build not found. Skipping frontend serving.');
}

connectDB()
  .then(() => {
    httpServer.listen(PORT, async () => {
      console.log(`🟢 Server running at: http://localhost:${PORT}`);
      initWebSocket(httpServer);
      createClient();

    
      try {
        await import('open').then(mod => mod.default('http://localhost:3000/login'));

        console.log('🌐 Opened frontend at http://localhost:3000/login');
      } catch (err) {
        console.warn(' Could not open browser:', err.message);  
      }
    });
  })
  .catch((err) => {
    console.error(' MongoDB connection error:', err.message);
  });

process.on('SIGINT', async () => {
  console.log('\Gracefully shutting down...');
  if (client) await client.destroy();
  process.exit(0);
});
console.log("Self-updater executed successfully at startup.");