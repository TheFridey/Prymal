/**
 * Converts rich schedule config (intervalType, timesPerDay, daysOfWeek, timezone)
 * into the next scheduled run timestamp and a node-cron expression.
 *
 * Design notes:
 *  - All times are stored as UTC; timezone is used only to interpret user-facing
 *    "hour of day" values (timesPerDay elements are local hours 0-23).
 *  - nextRunAt is always an absolute UTC timestamp.
 *  - cronExpression is best-effort for node-cron fallback; the DB scheduler
 *    uses nextRunAt as the source of truth.
 */

export const INTERVAL_TYPES = /** @type {const} */ ([
  'hourly',
  'daily',
  'multiple_times_daily',
  'weekly',
  'selected_days',
]);

/**
 * @param {string} tz
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the UTC offset in minutes for a given timezone at a given Date.
 * @param {string} tz
 * @param {Date} [at]
 * @returns {number} minutes ahead of UTC (negative = behind)
 */
function utcOffsetMinutes(tz, at = new Date()) {
  const utcStr = at.toLocaleString('en-US', { timeZone: 'UTC', hour12: false, hour: '2-digit', minute: '2-digit' });
  const tzStr = at.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
  const parse = (s) => {
    const [h, m] = s.replace('24:', '00:').split(':').map(Number);
    return h * 60 + m;
  };
  let diff = parse(tzStr) - parse(utcStr);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

/**
 * Converts a local hour (0-23) in the given timezone to UTC hours.
 * Returns an array because the UTC hour can wrap (e.g. UTC+11 hour 0 → UTC 13 previous day).
 * For cron we return the UTC hour modulo 24.
 * @param {number} localHour
 * @param {string} tz
 * @returns {number} UTC hour (0-23)
 */
function localHourToUtc(localHour, tz) {
  const offsetMin = utcOffsetMinutes(tz);
  return ((localHour * 60 - offsetMin) / 60 + 24) % 24;
}

/**
 * Given a schedule config, compute the next run time after `from`.
 *
 * @param {{
 *   intervalType: string,
 *   timesPerDay?: number[],
 *   daysOfWeek?: number[],
 *   timezone?: string,
 * }} schedule
 * @param {Date} [from] defaults to now
 * @returns {Date}
 */
export function computeNextRunAt(schedule, from = new Date()) {
  const { intervalType, timesPerDay = [], daysOfWeek = [], timezone = 'UTC' } = schedule;
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';

  switch (intervalType) {
    case 'hourly': {
      const next = new Date(from);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    }

    case 'daily': {
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      return nextOccurrence(from, null, hours, tz);
    }

    case 'multiple_times_daily': {
      const hours = timesPerDay.length > 0 ? timesPerDay : [9, 17];
      return nextOccurrence(from, null, hours, tz);
    }

    case 'weekly': {
      const days = daysOfWeek.length > 0 ? daysOfWeek : [1];
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      return nextOccurrence(from, days, hours, tz);
    }

    case 'selected_days': {
      if (daysOfWeek.length === 0) {
        throw new Error('selected_days interval requires at least one day in daysOfWeek.');
      }
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      return nextOccurrence(from, daysOfWeek, hours, tz);
    }

    default:
      throw new Error(`Unknown intervalType: ${intervalType}`);
  }
}

/**
 * Finds the next Date after `from` that falls on one of `days` (0=Sun…6=Sat, null = any)
 * at one of `localHours` in `tz`.
 */
function nextOccurrence(from, days, localHours, tz) {
  const sorted = [...localHours].sort((a, b) => a - b);

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let i = 0; i < 14 * 24 * 60; i++) {
    const localHour = Number(
      candidate.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).replace('24', '0'),
    );
    const localMinute = Number(
      candidate.toLocaleString('en-US', { timeZone: tz, minute: '2-digit' }),
    );
    const localDow = Number(
      candidate.toLocaleString('en-US', { timeZone: tz, weekday: 'short' })
        .replace(/Sun.*/, '0').replace(/Mon.*/, '1').replace(/Tue.*/, '2')
        .replace(/Wed.*/, '3').replace(/Thu.*/, '4').replace(/Fri.*/, '5').replace(/Sat.*/, '6'),
    );

    const dayOk = days === null || days.includes(localDow);
    const hourOk = sorted.includes(localHour) && localMinute === 0;

    if (dayOk && hourOk) {
      return candidate;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error('Could not find next run within 14 days – check your schedule config.');
}

/**
 * Derives a node-cron expression from schedule config.
 * For Trigger.dev / node-cron fallback only; nextRunAt is the authoritative source.
 *
 * @param {{
 *   intervalType: string,
 *   timesPerDay?: number[],
 *   daysOfWeek?: number[],
 *   timezone?: string,
 * }} schedule
 * @returns {string} cron expression (5 fields)
 */
export function computeCronExpression(schedule) {
  const { intervalType, timesPerDay = [], daysOfWeek = [], timezone = 'UTC' } = schedule;
  const tz = isValidTimezone(timezone) ? timezone : 'UTC';

  switch (intervalType) {
    case 'hourly':
      return '0 * * * *';

    case 'daily': {
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      const utcHours = hours.map((h) => Math.round(localHourToUtc(h, tz)));
      return `0 ${utcHours.join(',')} * * *`;
    }

    case 'multiple_times_daily': {
      const hours = timesPerDay.length > 0 ? timesPerDay : [9, 17];
      const utcHours = hours.map((h) => Math.round(localHourToUtc(h, tz)));
      return `0 ${utcHours.join(',')} * * *`;
    }

    case 'weekly': {
      const days = daysOfWeek.length > 0 ? daysOfWeek : [1];
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      const utcHours = hours.map((h) => Math.round(localHourToUtc(h, tz)));
      return `0 ${utcHours.join(',')} * * ${days.join(',')}`;
    }

    case 'selected_days': {
      if (daysOfWeek.length === 0) {
        throw new Error('selected_days interval requires at least one day in daysOfWeek.');
      }
      const hours = timesPerDay.length > 0 ? timesPerDay : [9];
      const utcHours = hours.map((h) => Math.round(localHourToUtc(h, tz)));
      return `0 ${utcHours.join(',')} * * ${daysOfWeek.join(',')}`;
    }

    default:
      throw new Error(`Unknown intervalType: ${intervalType}`);
  }
}

/**
 * Validates a schedule config object. Throws on invalid input.
 * @param {object} schedule
 */
export function validateScheduleConfig(schedule) {
  if (!schedule || typeof schedule !== 'object') {
    throw new Error('Schedule config must be an object.');
  }
  if (!INTERVAL_TYPES.includes(schedule.intervalType)) {
    throw new Error(`intervalType must be one of: ${INTERVAL_TYPES.join(', ')}.`);
  }
  if (schedule.timesPerDay !== undefined) {
    if (!Array.isArray(schedule.timesPerDay)) {
      throw new Error('timesPerDay must be an array of hour integers (0-23).');
    }
    for (const h of schedule.timesPerDay) {
      if (!Number.isInteger(h) || h < 0 || h > 23) {
        throw new Error(`timesPerDay values must be integers 0-23, got ${h}.`);
      }
    }
  }
  if (schedule.daysOfWeek !== undefined) {
    if (!Array.isArray(schedule.daysOfWeek)) {
      throw new Error('daysOfWeek must be an array of integers (0=Sun…6=Sat).');
    }
    for (const d of schedule.daysOfWeek) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw new Error(`daysOfWeek values must be integers 0-6, got ${d}.`);
      }
    }
  }
  if (schedule.timezone !== undefined && !isValidTimezone(schedule.timezone)) {
    throw new Error(`Invalid timezone: ${schedule.timezone}`);
  }
  if (schedule.intervalType === 'selected_days' && (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0)) {
    throw new Error('selected_days interval requires at least one day in daysOfWeek.');
  }
}
