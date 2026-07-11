/**
 * Temporal Type Utilities
 *
 * Provides duck-typing helpers for checking Temporal types.
 * Uses duck typing instead of instanceof to avoid issues with multiple
 * instances of temporal-polyfill being loaded.
 */

/**
 * Check that a value has the method surface shared by all Temporal types.
 * Plain data records can have numeric fields like {hour: 9, minute: 30}, but
 * they never carry Temporal's methods — without this check such records are
 * misdetected and serialize as "[object Object]" (every object inherits
 * toString, so checking toString alone does not discriminate).
 */
function hasTemporalMethods(value: any): boolean {
  return typeof value.equals === 'function' &&
         typeof value.add === 'function' &&
         typeof value.toString === 'function';
}

/**
 * Check if a value is a Temporal.PlainDate
 * PlainDate has year, month, day properties but no hour property
 */
export function isPlainDate(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.year === 'number' &&
         typeof value.month === 'number' &&
         typeof value.day === 'number' &&
         hasTemporalMethods(value) &&
         value.hour === undefined;  // PlainDate has no hour (0 is a valid hour!)
}

/**
 * Check if a value is a Temporal.Instant
 * Instant has epochNanoseconds property as a bigint
 */
export function isInstant(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.epochNanoseconds === 'bigint' &&
         hasTemporalMethods(value);
}

/**
 * Check if a value is a Temporal.ZonedDateTime
 * ZonedDateTime has a timeZoneId property
 */
export function isZonedDateTime(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.timeZoneId === 'string' &&
         hasTemporalMethods(value);
}

/**
 * Check if a value is a Temporal.PlainTime
 * PlainTime has hour and minute properties but no year
 */
export function isPlainTime(value: any): boolean {
  return value && typeof value === 'object' &&
         typeof value.hour === 'number' &&
         typeof value.minute === 'number' &&
         hasTemporalMethods(value) &&
         value.year === undefined;  // PlainTime has no year (year 0 is valid!)
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
         hasTemporalMethods(value) &&
         value.timeZoneId === undefined;  // PlainDateTime has no timeZoneId
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
