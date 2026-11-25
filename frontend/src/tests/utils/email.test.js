import { parseEmailAddress, parseEmailUserInfo } from '@/utils/email';

describe('email labels and avatar names', () => {
  test.each([
    ['sales@example.com', 'sales@example.com', false],
    ['sales@another.com', 'sales@another.com', false],
    ['<sales@example.com>', 'sales@example.com', false],
    ['"" <sales@example.com>', 'sales@example.com', false],
    ['"sales@team"@example.com', '"sales@team"@example.com', false],
    ['Sales Desk <sales@example.com>', 'Sales Desk', true],
    ['', '', false],
  ])('returns the custom name or complete email as name for %s', (address, name, isCustomizedName) => {
    expect(parseEmailAddress(address)).toMatchObject({ name, isCustomizedName });
    expect(parseEmailUserInfo(address)).toMatchObject({ name, isCustomizedName });
  });

  test('uses the complete email for parsed objects without a custom name', () => {
    const user = parseEmailAddress('sales@example.com');
    expect(parseEmailUserInfo(user)).toMatchObject({
      name: 'sales@example.com', initials: 'S',
    });
  });

  test('uses the supplied name for object labels and initials', () => {
    const user = { name: 'Sales Desk', email: 'sales@example.com', isCustomizedName: false };
    expect(parseEmailUserInfo(user)).toMatchObject({ name: 'Sales Desk', initials: 'SD' });
  });
});
