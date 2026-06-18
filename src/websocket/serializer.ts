/**
 * WebSocket JSON Serializer for Forthic
 * Mirrors gRPC serializer but outputs JSON instead of protobuf
 * Handles: int, float, string, bool, null, array, record, temporal types
 * Uses shared type detection from common/type_utils
 */

import { getForthicType, pathSegmentForKey } from "../common/type_utils.js";

// JSON StackValue format matching the WebSocket protocol
export interface StackValue {
  type: 'int' | 'float' | 'string' | 'bool' | 'null' | 'array' | 'record' | 'instant' | 'plain_date' | 'zoned_datetime';
  value: any;
}

/**
 * Serialize a JavaScript value to a JSON StackValue
 * Uses shared type detection and maps to JSON format
 */
export function serializeValue(value: any, path: string = ''): StackValue {
  const type = getForthicType(value, path);

  switch (type) {
    case 'null':
      return { type: 'null', value: null };

    case 'boolean':
      return { type: 'bool', value };

    case 'integer':
      return { type: 'int', value };

    case 'float':
      return { type: 'float', value };

    case 'string':
      return { type: 'string', value };

    case 'array':
      return {
        type: 'array',
        value: value.map((item: any, i: number) =>
          serializeValue(item, `${path}[${i}]`)),
      };

    case 'record': {
      // Any record-classified value may control its own wire form via a `toJSON`
      // method (standard JS hook); we serialize its return instead of walking the
      // live object. General by design — a StringRedirectSink is one user. (Temporal
      // types also have toJSON but are classified above, so they never reach here.)
      if (typeof value.toJSON === 'function') {
        return serializeValue(value.toJSON(), path);
      }
      const fields: { [key: string]: StackValue } = {};
      for (const [key, val] of Object.entries(value)) {
        fields[key] = serializeValue(val, `${path}${pathSegmentForKey(key)}`);
      }
      return {
        type: 'record',
        value: fields,
      };
    }

    case 'instant':
      return {
        type: 'instant',
        value: value.toString(),
      };

    case 'plain_date':
      return {
        type: 'plain_date',
        value: value.toString(),
      };

    case 'zoned_datetime':
      return {
        type: 'zoned_datetime',
        value: value.toString(),
      };

    default:
      throw new Error(`Unsupported Forthic type: ${type}${path ? ` at path: ${path}` : ''}`);
  }
}

/**
 * Deserialize a JSON StackValue to a JavaScript value
 */
export function deserializeValue(stackValue: StackValue, path: string = ''): any {
  switch (stackValue.type) {
    case 'int':
    case 'float':
    case 'string':
    case 'bool':
      return stackValue.value;

    case 'null':
      return null;

    case 'array':
      return (stackValue.value as StackValue[]).map((v, i) =>
        deserializeValue(v, `${path}[${i}]`));

    case 'record':
      return Object.entries(stackValue.value as Record<string, StackValue>).reduce(
        (acc, [k, v]) => {
          acc[k] = deserializeValue(v, `${path}${pathSegmentForKey(k)}`);
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
      throw new Error(`Unknown stack value type: ${(stackValue as any).type}${path ? ` at path: ${path}` : ''}`);
  }
}

/**
 * Serialize an array of values (stack)
 */
export function serializeStack(stack: any[], pathPrefix: string = ''): StackValue[] {
  return stack.map((value, i) => serializeValue(value, `${pathPrefix}[${i}]`));
}

/**
 * Deserialize an array of StackValues (stack)
 */
export function deserializeStack(stackValues: StackValue[], pathPrefix: string = ''): any[] {
  return stackValues.map((value, i) => deserializeValue(value, `${pathPrefix}[${i}]`));
}
