/**
 * Temporal Type Utilities
 *
 * Provides duck-typing helpers for checking Temporal types.
 * Uses duck typing instead of instanceof to avoid issues with multiple
 * instances of temporal-polyfill being loaded.
 */

/**
 * Check if a value is a Temporal.PlainDate
 * PlainDate has year, month, day properties but no hour property
 */
export function isPlainDate(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.year === 'number' &&
         typeof value.month === 'number' &&
         typeof value.day === 'number' &&
         typeof value.toString === 'function' &&
         !value.hour;  // PlainDate doesn't have hour
}

/**
 * Check if a value is a Temporal.Instant
 * Instant has epochNanoseconds property as a bigint
 */
export function isInstant(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.epochNanoseconds === 'bigint' &&
         typeof value.toString === 'function';
}

/**
 * Check if a value is a Temporal.ZonedDateTime
 * ZonedDateTime has a timeZoneId property
 */
export function isZonedDateTime(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.timeZoneId === 'string' &&
         typeof value.toString === 'function';
}

/**
 * Check if a value is a Temporal.PlainTime
 * PlainTime has hour and minute properties but no year
 */
export function isPlainTime(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.hour === 'number' &&
         typeof value.minute === 'number' &&
         typeof value.toString === 'function' &&
         !value.year;  // PlainTime doesn't have year
}

/**
 * Check if a value is a Temporal.PlainDateTime
 * PlainDateTime has year, month, day, hour properties but no timeZoneId
 */
export function isPlainDateTime(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.year === 'number' &&
         typeof value.month === 'number' &&
         typeof value.day === 'number' &&
         typeof value.hour === 'number' &&
         typeof value.toString === 'function' &&
         !value.timeZoneId;  // PlainDateTime doesn't have timeZoneId
}

/**
 * Check if a value is any Temporal type
 */
export function isTemporal(value: any): boolean {
  return isPlainDate(value) ||
         isInstant(value) ||
         isZonedDateTime(value) ||
         isPlainTime(value) ||
         isPlainDateTime(value);
}
