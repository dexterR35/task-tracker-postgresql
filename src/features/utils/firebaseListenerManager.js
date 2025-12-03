/**
 * Listener Manager (Legacy - No longer used)
 * 
 * This file is kept for backward compatibility but is no longer functional.
 * The app now uses WebSocket subscriptions via wsClient for real-time updates.
 * 
 * @deprecated Use wsClient from @/services/websocketClient instead
 */

import { logger } from "@/utils/logger";

class FirebaseListenerManager {
  constructor() {
    logger.warn('FirebaseListenerManager is deprecated. Use wsClient for real-time updates.');
    this.listeners = new Map();
  }

  addListener(key, setupFn, preserve = false, category = 'general', page = 'unknown') {
    logger.warn(`FirebaseListenerManager.addListener is deprecated. Use wsClient.subscribe() instead. Key: ${key}`);
    return () => {}; // Return no-op unsubscribe
  }

  removeListener(key) {
    logger.warn(`FirebaseListenerManager.removeListener is deprecated. Key: ${key}`);
  }

  hasListener(key) {
    return false;
  }

  clearAllListeners() {
    logger.warn('FirebaseListenerManager.clearAllListeners is deprecated.');
  }

  pauseListeners() {
    logger.warn('FirebaseListenerManager.pauseListeners is deprecated.');
  }

  resumeListeners() {
    logger.warn('FirebaseListenerManager.resumeListeners is deprecated.');
  }
}

// Create singleton instance for backward compatibility
const listenerManager = new FirebaseListenerManager();

export default listenerManager;
