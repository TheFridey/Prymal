export function getReservationThrottleDelayMs(reservation) {
  const delayMs = Number(
    reservation?.usageEvent?.metadata?.softThrottleMs
    ?? reservation?.costGuard?.throttleDelayMs
    ?? 0,
  );

  return normalizeDelayMs(delayMs);
}

export function getVideoJobThrottleDelayMs(job) {
  const providerDelayMs = Number(job?.providerMetadata?.costGuard?.throttleDelayMs ?? 0);
  const heavyUsageDelayMs = job?.heavyUsageFlagged ? 2_500 : 0;

  return Math.max(normalizeDelayMs(providerDelayMs), heavyUsageDelayMs);
}

export async function applyReservationThrottle(reservation) {
  const delayMs = getReservationThrottleDelayMs(reservation);
  await delay(delayMs);
  return delayMs;
}

export async function applyVideoJobThrottle(job) {
  const delayMs = getVideoJobThrottleDelayMs(job);
  await delay(delayMs);
  return delayMs;
}

export async function delay(ms) {
  const normalized = normalizeDelayMs(ms);

  if (!normalized) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, normalized);
  });
}

function normalizeDelayMs(value) {
  const normalized = Number(value ?? 0);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }

  return Math.round(normalized);
}
