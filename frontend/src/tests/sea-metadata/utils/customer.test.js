import {
  getCustomerDisplayString,
  getCustomersOptions,
} from '@/sea-metadata/utils/column';
import { isEmptyCustomerId } from '@/sea-metadata/utils/row';

jest.mock('@/constants', () => ({
  gettext: (text) => text,
}));

const customersData = {
  rows: [
    { _id: '7', name: 'Acme', status: 'active' },
    { _id: '9', name: 'Old Co', status: 'disabled' },
  ],
};

describe('getCustomersOptions', () => {
  test('maps customers onto option values keyed by id', () => {
    expect(getCustomersOptions(customersData)).toEqual([
      { value: '7', id: '7', name: 'Acme', status: 'active' },
      { value: '9', id: '9', name: 'Old Co', status: 'disabled' },
    ]);
  });

  test('returns an empty list without data', () => {
    expect(getCustomersOptions(undefined)).toEqual([]);
  });
});

describe('getCustomerDisplayString', () => {
  test('resolves a customer id to its name', () => {
    expect(getCustomerDisplayString(customersData, 7)).toBe('Acme');
    expect(getCustomerDisplayString(customersData, '7')).toBe('Acme');
  });

  test('returns an empty string for a missing value or an unknown customer', () => {
    expect(getCustomerDisplayString(customersData, '')).toBe('');
    expect(getCustomerDisplayString(customersData, 12345)).toBe('');
  });
});

describe('isEmptyCustomerId', () => {
  test('treats null, undefined, empty string and the FormData "null" as empty', () => {
    expect(isEmptyCustomerId(null)).toBe(true);
    expect(isEmptyCustomerId(undefined)).toBe(true);
    expect(isEmptyCustomerId('')).toBe(true);
    expect(isEmptyCustomerId('null')).toBe(true);
  });

  test('treats ids as set, including 0', () => {
    expect(isEmptyCustomerId(7)).toBe(false);
    expect(isEmptyCustomerId('7')).toBe(false);
    expect(isEmptyCustomerId(0)).toBe(false);
  });
});
