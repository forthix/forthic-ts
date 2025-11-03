/**
 * WebSocket JSON Serializer for Forthic
 * Mirrors gRPC serializer but outputs JSON instead of protobuf
 * Handles: int, float, string, bool, null, array, record, temporal types
 */

import { Temporal } from "temporal-polyfill";
import { isPlainDate, isInstant, isZonedDateTime } from "../grpc/temporal_utils.js";

// JSON StackValue format matching the WebSocket protocol
export interface StackValue {
  type: 'int' | 'float' | 'string' | 'bool' | 'null' | 'array' | 'record' | 'instant' | 'plain_date' | 'zoned_datetime';
  value: any;
}

/**
 * Serialize a JavaScript value to a JSON StackValue
 */
export function serializeValue(value: any): StackValue {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { type: 'null', value: null };
  }

  // Handle Temporal types (check ZonedDateTime BEFORE Instant)
  if (isZonedDateTime(value)) {
    return {
      type: 'zoned_datetime',
      value: value.toString(),
    };
  }

  if (isInstant(value)) {
    return {
      type: 'instant',
      value: value.toString(),
    };
  }

  if (isPlainDate(value)) {
    return {
      type: 'plain_date',
      value: value.toString(),
    };
  }

  // Handle boolean (check before number)
  if (typeof value === 'boolean') {
    return { type: 'bool', value };
  }

  // Handle number
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { type: 'int', value };
    } else {
      return { type: 'float', value };
    }
  }

  // Handle string
  if (typeof value === 'string') {
    return { type: 'string', value };
  }

  // Handle array
  if (Array.isArray(value)) {
    return {
      type: 'array',
      value: value.map((item) => serializeValue(item)),
    };
  }

  // Handle object/record
  if (typeof value === 'object') {
    const fields: { [key: string]: StackValue } = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = serializeValue(val);
    }
    return {
      type: 'record',
      value: fields,
    };
  }

  throw new Error(`Cannot serialize value: ${value}`);
}

/**
 * Deserialize a JSON StackValue to a JavaScript value
 */
export function deserializeValue(stackValue: StackValue): any {
  switch (stackValue.type) {
    case 'int':
    case 'float':
    case 'string':
    case 'bool':
      return stackValue.value;

    case 'null':
      return null;

    case 'array':
      return (stackValue.value as StackValue[]).map((v) => deserializeValue(v));

    case 'record':
      return Object.entries(stackValue.value as Record<string, StackValue>).reduce(
        (acc, [k, v]) => {
          acc[k] = deserializeValue(v);
          return acc;
        },
        {} as Record<string, any>
      );

    case 'instant':
      return Temporal.Instant.from(stackValue.value as string);

    case 'plain_date':
      return Temporal.PlainDate.from(stackValue.value as string);

    case 'zoned_datetime':
      return Temporal.ZonedDateTime.from(stackValue.value as string);

    default:
      throw new Error(`Unknown stack value type: ${(stackValue as any).type}`);
  }
}

/**
 * Serialize an array of values (stack)
 */
export function serializeStack(stack: any[]): StackValue[] {
  return stack.map((value) => serializeValue(value));
}

/**
 * Deserialize an array of StackValues (stack)
 */
export function deserializeStack(stackValues: StackValue[]): any[] {
  return stackValues.map((value) => deserializeValue(value));
}
