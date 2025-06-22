
const { Server } = require('socket.io');
let ioInstance = null;

function initWebSocket(server) {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  ioInstance = io;
  console.log(' WebSocket server initialized');

  io.on('connection', (socket) => {
    console.log(' WebSocket client connected');
  });
}

function broadcastQR(qr) {
  if (ioInstance) {
    ioInstance.emit('qr', qr);
  }
}

function broadcastStatus(status) {
  if (ioInstance) {
    ioInstance.emit('status', status);
  }
}

module.exports = { initWebSocket, broadcastQR, broadcastStatus };
