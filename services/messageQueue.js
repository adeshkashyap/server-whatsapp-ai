// messageQueue.js
let queue = [];
let isProcessing = false;

function addToQueue(sendFn) {
  queue.push(sendFn);
  if (!isProcessing) processQueue();
}

async function processQueue() {
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await job();
      await new Promise(res => setTimeout(res, 1000)); // 1 sec delay between sends
    } catch (err) {
      console.error(' Failed to send message from queue:', err.message);
    }
  }

  isProcessing = false;
}

module.exports = { addToQueue };
