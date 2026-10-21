import { getAutoBackgroundColor } from '../../portal/color-utils';

describe('getAutoBackgroundColor', () => {
  test('blends 8% of the theme color into white', () => {
    expect(getAutoBackgroundColor('FF8000')).toBe('#FFF5EB');
  });
});
