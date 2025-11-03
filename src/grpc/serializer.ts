/**
 * Phase 2: Serialization/Deserialization for all basic Forthic types
 * Handles: int, float, string, bool, null, array, record/object
 * Phase 8: Added temporal types (Temporal.Instant, Temporal.PlainDate, Temporal.ZonedDateTime)
 */

import { Temporal } from "temporal-polyfill";
import { isPlainDate, isInstant, isZonedDateTime } from "./temporal_utils.js";

// Type definitions matching the protobuf schema
interface StackValue {
  int_value?: number;
  string_value?: string;
  bool_value?: boolean;
  float_value?: number;
  null_value?: Record<string, never>;
  array_value?: ArrayValue;
  record_value?: RecordValue;
  instant_value?: InstantValue;
  plain_date_value?: PlainDateValue;
  zoned_datetime_value?: ZonedDateTimeValue;
}

interface ArrayValue {
  items: StackValue[];
}

interface RecordValue {
  fields: { [key: string]: StackValue };
}

interface InstantValue {
  iso8601: string;
}

interface PlainDateValue {
  iso8601_date: string;
}

interface ZonedDateTimeValue {
  iso8601: string;
  timezone: string;
}

/**
 * Serialize a JavaScript value to a StackValue protobuf message
 */
export function serializeValue(value: any): StackValue {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { null_value: {} };
  }

  // Handle Temporal types using duck typing to avoid instanceof issues with multiple library instances
  // IMPORTANT: Check ZonedDateTime BEFORE Instant, as ZonedDateTime may also match isInstant()
  if (isZonedDateTime(value)) {
    return {
      zoned_datetime_value: {
        iso8601: value.toString(),
        timezone: value.timeZoneId,
      },
    };
  }

  if (isInstant(value)) {
    return {
      instant_value: {
        iso8601: value.toString(),
      },
    };
  }

  if (isPlainDate(value)) {
    return {
      plain_date_value: {
        iso8601_date: value.toString(),
      },
    };
  }

  // Handle boolean (check before number since typeof true === 'boolean')
  if (typeof value === 'boolean') {
    return { bool_value: value };
  }

  // Handle number
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { int_value: value };
    } else {
      return { float_value: value };
    }
  }

  // Handle string
  if (typeof value === 'string') {
    return { string_value: value };
  }

  // Handle array
  if (Array.isArray(value)) {
    return {
      array_value: {
        items: value.map((item) => serializeValue(item)),
      },
    };
  }

  // Handle object/record
  if (typeof value === 'object') {
    const fields: { [key: string]: StackValue } = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = serializeValue(val);
    }
    return {
      record_value: { fields },
    };
  }

  throw new Error(`Unsupported value type: ${typeof value}`);
}

/**
 * Deserialize a StackValue protobuf message to a JavaScript value
 */
export function deserializeValue(stackValue: StackValue): any {
  if ('int_value' in stackValue) {
    return stackValue.int_value;
  }

  if ('string_value' in stackValue) {
    return stackValue.string_value;
  }

  if ('bool_value' in stackValue) {
    return stackValue.bool_value;
  }

  if ('float_value' in stackValue) {
    return stackValue.float_value;
  }

  if ('null_value' in stackValue) {
    return null;
  }

  if ('instant_value' in stackValue && stackValue.instant_value) {
    return Temporal.Instant.from(stackValue.instant_value.iso8601);
  }

  if ('plain_date_value' in stackValue && stackValue.plain_date_value) {
    return Temporal.PlainDate.from(stackValue.plain_date_value.iso8601_date);
  }

  if ('zoned_datetime_value' in stackValue && stackValue.zoned_datetime_value) {
    // Parse ISO string which includes timezone information
    return Temporal.ZonedDateTime.from(stackValue.zoned_datetime_value.iso8601);
  }

  if ('array_value' in stackValue && stackValue.array_value) {
    return stackValue.array_value.items.map((item) => deserializeValue(item));
  }

  if ('record_value' in stackValue && stackValue.record_value) {
    const result: { [key: string]: any } = {};
    for (const [key, val] of Object.entries(stackValue.record_value.fields)) {
      result[key] = deserializeValue(val);
    }
    return result;
  }

  throw new Error('Unknown stack value type');
}
