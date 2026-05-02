import { api } from './api';

export async function trackProductEvent(eventName, metadata = {}) {
  try {
    await api.post('/org/product-events', {
      eventName,
      metadata,
    });
  } catch {
    // Product analytics should never block the user path.
  }
}
