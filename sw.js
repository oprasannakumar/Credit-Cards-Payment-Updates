const API_URL = "https://script.google.com/macros/s/AKfycbwSR9-Kgq6dMjoOg0dSiJ_mXsFlrIz6qkw8BkeJQC0lwjDuEhTW_nvKhsrmGKzag732CA/exec";

// Time settings in milliseconds
const INTERVALS = {
  test: 2 * 60 * 1000,      // 2 Minutes
  prod: 4 * 60 * 60 * 1000  // 4 Hours
};

let currentMode = "test";
let loopTrackerInstance = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CONVERT_PROFILE') {
    currentMode = event.data.mode;
    console.log(`Background radar configured to target profile: ${currentMode}`);
    
    // Reboot thread sequence loop immediately to shift timing intervals smoothly
    if (loopTrackerInstance) clearTimeout(loopTrackerInstance);
    executeRadarScanLoop();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  executeRadarScanLoop();
});

// Self-healing execution wrapper loop
function executeRadarScanLoop() {
  scanDuesAndNotify();
  
  const delayDuration = INTERVALS[currentMode] || INTERVALS.test;
  loopTrackerInstance = setTimeout(executeRadarScanLoop, delayDuration);
}

async function scanDuesAndNotify() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    // Find all nodes that are not marked as paid
    const unpaidCards = data.filter(item => !item.status || item.status.toLowerCase() !== 'paid');

    if (unpaidCards.length === 0) return;

    for (const card of unpaidCards) {
      const amt = parseFloat(card.amount) || 0;
      const cardTitle = card.cardName || 'Unknown Card';
      
      let msgBody = `Outstanding balance tracker alert: ₹${amt} is pending.`;
      
      if (card.dueDate) {
        msgBody += ` (Due: ${card.dueDate.split('T')[0]})`;
      }

      await self.registration.showNotification(`Quantum Liability Alert`, {
        body: `${cardTitle}: ${msgBody} Clear balance to stop alerts.`,
        icon: "https://cdn-icons-png.flaticon.com/512/2092/2092663.png",
        badge: "https://cdn-icons-png.flaticon.com/512/2092/2092663.png",
        tag: `always-alert-${card.cardName}-${card.row}`, // Unique string grouping identifier per card
        renotify: true, // Forces phone to vibrate/ring even if older notification card is visible
        requireInteraction: true // Keeps alert pinned to screen layout until manually dismissed
      });
    }
  } catch (err) {
    console.error("Background active thread execution exception: ", err);
  }
}
