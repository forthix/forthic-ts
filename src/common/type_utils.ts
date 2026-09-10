/**
 * Shared type detection utilities for Forthic value serialization
 * Used by both the JSON-RPC and WebSocket serializers
 */

import { isPlainDate, isPlainTime, isInstant, isZonedDateTime } from './temporal_utils.js';
import { CollectionMark } from '../forthic/tokenizer.js';

/**
 * Forthic value types
 */
export type ForthicType =
  | 'null'
  | 'boolean'
  | 'integer'
  | 'float'
  | 'string'
  | 'array'
  | 'record'
  | 'instant'
  | 'plain_date'
  | 'plain_time'
  | 'zoned_datetime';

/**
 * Get the Forthic type of a JavaScript value
 * Determines the correct serialization type for a value
 *
 * IMPORTANT: Order matters!
 * - Check temporal types BEFORE primitives (they're objects)
 * - Check ZonedDateTime BEFORE Instant (ZonedDateTime may match isInstant)
 * - Check boolean BEFORE number (to avoid typeof confusion)
 * - Check array BEFORE object (arrays are objects)
 */
export function getForthicType(value: any, path: string = ''): ForthicType {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 'null';
  }

  // Handle Temporal types (check ZonedDateTime BEFORE Instant)
  if (isZonedDateTime(value)) {
    return 'zoned_datetime';
  }

  if (isInstant(value)) {
    return 'instant';
  }

  if (isPlainDate(value)) {
    return 'plain_date';
  }

  if (isPlainTime(value)) {
    return 'plain_time';
  }

  // Handle boolean (check before number)
  if (typeof value === 'boolean') {
    return 'boolean';
  }

  // Handle number (distinguish integer vs float)
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'float';
  }

  // Handle string
  if (typeof value === 'string') {
    return 'string';
  }

  // Handle array (check before object)
  if (Array.isArray(value)) {
    return 'array';
  }

  // A collection mark is an interpreter control value, like WordOptions: it has
  // no wire representation and must not acquire one by accident. Without this
  // branch it falls through to 'record' below and a mark left on the stack (say
  // by `[ DUP 1 ]`) crosses the wire as an ordinary record of parser internals,
  // which the receiving runtime cannot tell from real data.
  if (value instanceof CollectionMark) {
    throw new Error(
      `A collection mark (${value}) cannot be serialized - it is interpreter state, not data. An unclosed '${value.open}' left it on the stack${path ? ` at path: ${path}` : ''}`,
    );
  }

  // Handle object/record
  if (typeof value === 'object') {
    return 'record';
  }

  throw new Error(`Unsupported value type: ${typeof value}${path ? ` at path: ${path}` : ''}`);
}

/**
 * Format a record key as a path segment.
 * Valid JS identifiers become `.key`; everything else becomes `["key"]` (JSON-escaped)
 * so the path is unambiguous and copy-pasteable.
 */
export function pathSegmentForKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `.${key}`
    : `[${JSON.stringify(key)}]`;
}

/**
 * Check if a value is a temporal type
 */
export function isTemporalType(value: any): boolean {
  return isInstant(value) || isPlainDate(value) || isZonedDateTime(value);
}

/**
 * Check if a value is a primitive type (not array or record)
 */
export function isPrimitive(value: any): boolean {
  const type = getForthicType(value);
  return type !== 'array' && type !== 'record';
}

/**
 * Check if a value is a container type (array or record)
 */
export function isContainer(value: any): boolean {
  const type = getForthicType(value);
  return type === 'array' || type === 'record';
}
