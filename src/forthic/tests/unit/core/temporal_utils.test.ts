/**
 * Duck-typing type detection for Temporal values. The bug these guard against:
 * `!value.hour` / `!value.year` treat a legitimate 0 (midnight, or year 0) as
 * "property absent", misclassifying a PlainDateTime at midnight as a PlainDate
 * (which then serializes as a bare date, dropping the time).
 */
import { isPlainDate, isPlainDateTime, isPlainTime } from "../../../../common/temporal_utils";

describe("temporal type detection at boundary values", () => {
  test("a PlainDateTime at midnight is not misclassified as a PlainDate", () => {
    const midnight = Temporal.PlainDateTime.from("2024-01-15T00:00:00");
    expect(isPlainDate(midnight)).toBe(false);
    expect(isPlainDateTime(midnight)).toBe(true);
  });

  test("a real PlainDate is still a PlainDate", () => {
    const date = Temporal.PlainDate.from("2024-01-15");
    expect(isPlainDate(date)).toBe(true);
    expect(isPlainDateTime(date)).toBe(false);
  });

  test("a PlainDateTime with a nonzero hour is unaffected", () => {
    const dt = Temporal.PlainDateTime.from("2024-01-15T09:30:00");
    expect(isPlainDate(dt)).toBe(false);
    expect(isPlainDateTime(dt)).toBe(true);
  });

  test("a PlainTime is detected regardless of hour value", () => {
    const t = Temporal.PlainTime.from("00:00:00");
    expect(isPlainTime(t)).toBe(true);
    expect(isPlainDate(t)).toBe(false);
  });
});
