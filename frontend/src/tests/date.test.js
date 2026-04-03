import { getTime } from '../utils/date';

describe('getTime', () => {
  
  test('should return formatted time "HH:mm:ss" for a valid Date object', () => {
    const date = new Date(2023, 10, 20, 14, 30, 45); // 14:30:45
    expect(getTime(date)).toBe('14:30:45');
  });

  test('should pad single-digit hours, minutes, and seconds with a leading zero', () => {
    const date = new Date(2023, 10, 20, 5, 8, 9); // 05:08:09
    expect(getTime(date)).toBe('05:08:09');
  });

  test('should return "00:00:00" for midnight', () => {
    const date = new Date(2023, 10, 20, 0, 0, 0); // 00:00:00
    expect(getTime(date)).toBe('00:00:00');
  });

  test('should return "23:59:59" for the last second of the day', () => {
    const date = new Date(2023, 10, 20, 23, 59, 59); // 23:59:59
    expect(getTime(date)).toBe('23:59:59');
  });

  test('should return null for an Invalid Date object', () => {
    const invalidDate = new Date('invalid-string');
    expect(getTime(invalidDate)).toBeNull();
  });

  test('should return null for non-Date objects', () => {
    expect(getTime(null)).toBeNull();
    expect(getTime(undefined)).toBeNull();
    expect(getTime('2023-10-20')).toBeNull();
    expect(getTime(1697810000000)).toBeNull(); // Timestamp number is not an instance of Date
    expect(getTime({})).toBeNull();
  });

  test('should correctly handle midday (12:00:00)', () => {
    const date = new Date(2023, 10, 20, 12, 0, 0);
    expect(getTime(date)).toBe('12:00:00');
  });
});
