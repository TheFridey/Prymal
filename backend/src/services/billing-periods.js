export function getBillingPeriodWindow(subscription = {}, now = new Date()) {
  const start = toValidDate(subscription.currentPeriodStart);
  const end = toValidDate(subscription.currentPeriodEnd);

  if (start && end && end > start) {
    return { start, end, source: 'subscription' };
  }

  const anchor = toValidDate(now) ?? new Date();
  const fallbackStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const fallbackEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));

  return {
    start: fallbackStart,
    end: fallbackEnd,
    source: 'calendar_month',
  };
}

export function isWithinBillingPeriod(timestamp, subscription = {}, now = new Date()) {
  const eventAt = toValidDate(timestamp);
  if (!eventAt) return false;
  const { start, end } = getBillingPeriodWindow(subscription, now);
  return eventAt >= start && eventAt < end;
}

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
