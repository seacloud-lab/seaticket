import { areArraysEqual } from '../utils/array-utils';

describe('areArraysEqual', () => {
  
  test('should return true for identical arrays in the same order', () => {
    expect(areArraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(areArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  test('should return true for identical arrays in different order', () => {
    expect(areArraysEqual([1, 2, 3], [3, 2, 1])).toBe(true);
    expect(areArraysEqual(['apple', 'orange'], ['orange', 'apple'])).toBe(true);
  });

  test('should return true for arrays with duplicate elements in different order', () => {
    expect(areArraysEqual([1, 2, 2, 3], [3, 2, 1, 2])).toBe(true);
  });

  test('should return false for arrays with different lengths', () => {
    expect(areArraysEqual([1, 2, 3], [1, 2])).toBe(false);
    expect(areArraysEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  test('should return false for arrays with same length but different elements', () => {
    expect(areArraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(areArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  test('should return false if element frequencies do not match', () => {
    // Both have length 3, but different counts of '1' and '2'
    expect(areArraysEqual([1, 1, 2], [1, 2, 2])).toBe(false);
  });

  test('should return true for two empty arrays', () => {
    expect(areArraysEqual([], [])).toBe(true);
  });
});
