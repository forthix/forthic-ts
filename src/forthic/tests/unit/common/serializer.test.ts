/**
 * Unit tests for gRPC serializer (also covers JSON-RPC, which re-exports it)
 */
import { serializeValue, deserializeValue } from '../../../../common/serializer.js';

describe('Wire Serializer', () => {
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

    test('plain time round-trip', () => {
      const value = Temporal.PlainTime.from('09:30:00');
      const roundTripped = deserializeValue(serializeValue(value));
      expect(roundTripped).toBeInstanceOf(Temporal.PlainTime);
      expect(roundTripped.equals(value)).toBe(true);
    });

    test('plain time with milliseconds round-trip', () => {
      const value = Temporal.PlainTime.from('09:30:00.123');
      const roundTripped = deserializeValue(serializeValue(value));
      expect(roundTripped.equals(value)).toBe(true);
    });
  });

  describe('Temporal duck-typing does not swallow look-alike records', () => {
    // Regression: records with temporal-shaped numeric fields used to
    // misdetect as Temporal values (every object inherits toString) and
    // serialize as "[object Object]" strings.
    test.each([
      [{ hour: 9, minute: 30 }],
      [{ year: 2020, month: 6, day: 5 }],
      [{ timeZoneId: 'America/Los_Angeles', label: 'home' }],
      [{ year: 2020, month: 6, day: 5, hour: 10 }],
    ])('record %j stays a record', (value) => {
      const wire = serializeValue(value);
      expect(wire.record_value).toBeDefined();
      expect(deserializeValue(wire)).toEqual(value);
    });
  });

  describe('Plain time wire format', () => {
    test('serializes to plain_time_value with ISO time string', () => {
      expect(serializeValue(Temporal.PlainTime.from('09:30:00'))).toEqual({
        plain_time_value: { iso8601_time: '09:30:00' },
      });
    });

    test('deserializes plain_time_value', () => {
      const value = deserializeValue({ plain_time_value: { iso8601_time: '23:59:59' } });
      expect(value).toBeInstanceOf(Temporal.PlainTime);
      expect(value.toString()).toBe('23:59:59');
    });
  });

  describe('Error handling', () => {
    describe('serialize', () => {
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

    describe('deserialize', () => {
      test('top-level unknown type has no path suffix', () => {
        const invalidValue = {} as any;
        expect(() => deserializeValue(invalidValue)).toThrow(/^Unknown stack value type$/);
      });

      test('unknown type inside record reports key path', () => {
        const invalidValue = {
          record_value: {
            fields: { bad: {} },
          },
        } as any;
        expect(() => deserializeValue(invalidValue)).toThrow(
          'Unknown stack value type at path: .bad'
        );
      });

      test('unknown type deeply nested reports full path', () => {
        const invalidValue = {
          record_value: {
            fields: {
              a: {
                array_value: { items: [{}] },
              },
            },
          },
        } as any;
        expect(() => deserializeValue(invalidValue)).toThrow(
          'Unknown stack value type at path: .a[0]'
        );
      });
    });
  });
});

// A whole number goes on the wire as an int only when it is a safe integer.
// Other runtimes read int_value into a 64-bit integer, and a JS number past
// 2^53 is not exact anyway, so it goes as a float instead of overflowing there.
describe('Integers on the wire', () => {
  test.each([
    ['0', 0],
    ['a small negative', -42],
    ['the largest safe integer', Number.MAX_SAFE_INTEGER],
    ['the smallest safe integer', Number.MIN_SAFE_INTEGER],
  ])('%s is an int', (_label, n) => {
    expect(serializeValue(n)).toEqual({ int_value: n });
  });

  test.each([
    ['2^53', 2 ** 53],
    ['-(2^53)', -(2 ** 53)],
    ['1e21', 1e21],
    ['past int64', 2 ** 64],
  ])('%s is a float', (_label, n) => {
    expect(serializeValue(n)).toEqual({ float_value: n });
    expect(deserializeValue(serializeValue(n))).toBe(n);
  });
});
