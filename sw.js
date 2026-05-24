const API_URL = "https://script.google.com/macros/s/AKfycbwSR9-Kgq6dMjoOg0dSiJ_mXsFlrIz6qkw8BkeJQC0lwjDuEhTW_nvKhsrmGKzag732CA/exec";

const INTERVALS = {
  test: 2 * 60 * 1000,      // 2 Minutes
  prod: 4 * 60 * 60 * 1000  // 4 Hours
};

let currentMode = "test";
let activeIntervalId = null;

// Force immediate activation when updated
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      startPersistentRadar();
    })
  );
});

// Listen for profile changes from the UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CONVERT_PROFILE') {
    currentMode = event.data.mode;
    
    // Reset and restart the loop with the new interval immediately
    startPersistentRadar();
  }
});

function startPersistentRadar() {
  if (activeIntervalId) {
    clearInterval(activeIntervalId);
  }

  // Run a scan immediately on startup/switch
  scanDuesAndNotify();

  // Use setInterval managed directly by the Service Worker global scope
  const delayDuration = INTERVALS[currentMode] || INTERVALS.test;
  activeIntervalId = setInterval(() => {
    scanDuesAndNotify();
  }, delayDuration);
}

async function scanDuesAndNotify() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    // Filter out only unpaid cards
    const unpaidCards = data.filter(item => !item.status || item.status.toLowerCase() !== 'paid');

    if (unpaidCards.length === 0) return;

    for (const card of unpaidCards) {
      const amt = parseFloat(card.amount) || 0;
      const cardTitle = card.cardName || 'Unknown Card';
      
      let msgBody = `Pending Balance: ₹${amt}.`;
      if (card.dueDate) {
        msgBody += ` (Due: ${card.dueDate.split('T')[0]})`;
      }

      await self.registration.showNotification(`Quantum Liability Alert`, {
        body: `${cardTitle}: ${msgBody} Clear to stop alerts.`,
        icon: "https://cdn-icons-png.flaticon.com/512/2092/2092663.png",
        badge: "https://cdn-icons-png.flaticon.com/512/2092/2092663.png",
        tag: `always-alert-${card.cardName}`, // Keeps notifications grouped cleanly
        renotify: true,                      // Forces device vibration/sound every 2 mins
        requireInteraction: true             // Stays pinned on screen until swiped
      });
    }
  } catch (err) {
    console.error("Background background engine sync failure: ", err);
  }
}
