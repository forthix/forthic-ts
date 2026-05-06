/**
 * Unit tests for gRPC serializer (also covers JSON-RPC, which re-exports it)
 */
import { serializeValue, deserializeValue } from '../../../../grpc/serializer.js';

describe('gRPC Serializer', () => {
  describe('Round-trip smoke tests', () => {
    test('integer round-trip', () => {
      expect(deserializeValue(serializeValue(42))).toBe(42);
    });

    test('record round-trip', () => {
      const value = { name: 'Alice', age: 30 };
      expect(deserializeValue(serializeValue(value))).toEqual(value);
    });

    test('nested array/record round-trip', () => {
      const value = { items: [1, 'two', { nested: true }] };
      expect(deserializeValue(serializeValue(value))).toEqual(value);
    });
  });

  describe('Error handling', () => {
    test('top-level unsupported value has no path suffix', () => {
      expect(() => serializeValue(() => 1)).toThrow(/^Unsupported value type: function$/);
    });

    test('unsupported value inside record reports key path', () => {
      expect(() => serializeValue({ cb: () => 1 })).toThrow(
        'Unsupported value type: function at path: .cb'
      );
    });

    test('unsupported value inside array reports index path', () => {
      expect(() => serializeValue([0, () => 1, 2])).toThrow(
        'Unsupported value type: function at path: [1]'
      );
    });

    test('deeply nested unsupported value reports full path', () => {
      const value = { a: { b: [{ fn: () => 1 }] } };
      expect(() => serializeValue(value)).toThrow(
        'Unsupported value type: function at path: .a.b[0].fn'
      );
    });

    test('record key with special characters uses bracket notation', () => {
      const value = { 'weird key': () => 1 };
      expect(() => serializeValue(value)).toThrow(
        'Unsupported value type: function at path: ["weird key"]'
      );
    });
  });
});
