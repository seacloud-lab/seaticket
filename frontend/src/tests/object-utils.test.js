import ObjectUtils, {
  hasOwnProperty,
  isEmptyObject,
  shallowCloneObject,
} from '../utils/object-utils';

describe('ObjectUtils', () => {
  describe('getDataType', () => {
    test('returns the expected type for common values', () => {
      expect(ObjectUtils.getDataType([])).toBe('Array');
      expect(ObjectUtils.getDataType({})).toBe('Object');
      expect(ObjectUtils.getDataType('hello')).toBe('string');
      expect(ObjectUtils.getDataType(123)).toBe('number');
      expect(ObjectUtils.getDataType(null)).toBe('Null');
    });
  });

  describe('iterable', () => {
    test('returns true for objects and arrays only', () => {
      expect(ObjectUtils.iterable({})).toBe(true);
      expect(ObjectUtils.iterable([])).toBe(true);
      expect(ObjectUtils.iterable('hello')).toBe(false);
      expect(ObjectUtils.iterable(123)).toBe(false);
      expect(ObjectUtils.iterable(null)).toBe(false);
    });
  });

  describe('isObjectChanged', () => {
    test('returns false for equal objects', () => {
      expect(ObjectUtils.isObjectChanged({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(false);
    });

    test('returns true for different values or types', () => {
      expect(ObjectUtils.isObjectChanged({ a: 1 }, { a: 2 })).toBe(true);
      expect(ObjectUtils.isObjectChanged({ a: 1 }, { a: '1' })).toBe(true);
      expect(ObjectUtils.isObjectChanged({ a: 1 }, { a: 1, b: 2 })).toBe(true);
    });

    test('ignores keys passed in notIncludeKeys', () => {
      expect(ObjectUtils.isObjectChanged(
        { a: 1, updatedAt: 'old' },
        { a: 1, updatedAt: 'new' },
        ['updatedAt'],
      )).toBe(false);
    });

    test('compares nested objects recursively', () => {
      expect(ObjectUtils.isObjectChanged(
        { a: { b: 1 } },
        { a: { b: 1 } },
      )).toBe(false);
      expect(ObjectUtils.isObjectChanged(
        { a: { b: 1 } },
        { a: { b: 2 } },
      )).toBe(true);
    });

    test('throws when source is not iterable', () => {
      expect(() => ObjectUtils.isObjectChanged('x', 'y')).toThrow(
        'source should be a Object or Array , but got string',
      );
    });
  });

  describe('isSameObject', () => {
    test('treats two falsy values as the same', () => {
      expect(ObjectUtils.isSameObject(null, undefined)).toBe(true);
    });

    test('returns false when only one value is present', () => {
      expect(ObjectUtils.isSameObject({ a: 1 }, null)).toBe(false);
      expect(ObjectUtils.isSameObject(null, { a: 1 })).toBe(false);
    });

    test('returns true for equal objects', () => {
      expect(ObjectUtils.isSameObject({ a: 1 }, { a: 1 })).toBe(true);
    });
  });

  describe('isEmpty', () => {
    test('returns true only for empty plain objects', () => {
      expect(ObjectUtils.isEmpty({})).toBe(true);
      expect(ObjectUtils.isEmpty({ a: 1 })).toBe(false);
      expect(ObjectUtils.isEmpty([])).toBe(false);
      expect(ObjectUtils.isEmpty(null)).toBeNull();
    });
  });
});

describe('object utils helpers', () => {
  describe('hasOwnProperty', () => {
    test('returns true only for own properties', () => {
      const obj = Object.create({ inherited: true });
      obj.own = true;

      expect(hasOwnProperty(obj, 'own')).toBe(true);
      expect(hasOwnProperty(obj, 'inherited')).toBe(false);
      expect(hasOwnProperty(null, 'own')).toBe(false);
      expect(hasOwnProperty(obj, '')).toBe(false);
    });
  });

  describe('isEmptyObject', () => {
    test('returns true for an empty object and false otherwise', () => {
      expect(isEmptyObject({})).toBe(true);
      expect(isEmptyObject({ a: 1 })).toBe(false);
    });
  });

  describe('shallowCloneObject', () => {
    test('clones only own enumerable properties', () => {
      const proto = { inherited: 'skip' };
      const source = Object.create(proto);
      source.own = 'keep';

      expect(shallowCloneObject(source)).toEqual({ own: 'keep' });
      expect(shallowCloneObject(source)).not.toBe(source);
    });
  });
});
