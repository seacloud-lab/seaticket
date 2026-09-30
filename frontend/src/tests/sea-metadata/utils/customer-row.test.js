import { CellType } from '@/sea-metadata/constants';
import { convertRowToNameValue, convertRowToKeyValue } from '@/sea-metadata/utils/row';

jest.mock('@/constants', () => ({
  gettext: (text) => text,
}));

const customerColumn = {
  key: 'k_customer',
  name: 'customer_id',
  type: CellType.CUSTOMER,
};

const data = {
  columns: [customerColumn],
};

describe('convertRowToNameValue for a customer column', () => {
  test('sends the id itself, not an option name', () => {
    // a single-select would convert this to the option name and break the int64 column
    expect(convertRowToNameValue({ k_customer: '7' }, { data })).toEqual({ customer_id: '7' });
  });

  test('normalises a numeric id to a string', () => {
    // keeps the value equal to the option values the editors compare against
    expect(convertRowToNameValue({ k_customer: 7 }, { data })).toEqual({ customer_id: '7' });
  });

  test.each([[''], [null], [undefined], ['null']])(
    'clears the customer for %p', (value) => {
      expect(convertRowToNameValue({ k_customer: value }, { data })).toEqual({ customer_id: '' });
    },
  );
});

describe('convertRowToKeyValue for a customer column', () => {
  test('sends the id as a string', () => {
    expect(convertRowToKeyValue({ customer_id: '7' }, { data: { columns: [customerColumn] } }))
      .toEqual({ k_customer: '7' });
  });

  test('clears the customer', () => {
    expect(convertRowToKeyValue({ customer_id: '' }, { data: { columns: [customerColumn] } }))
      .toEqual({ k_customer: '' });
  });
});
