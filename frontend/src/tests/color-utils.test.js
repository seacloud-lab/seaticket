import { isHexColor, parseColorToRGB, isDarkColor, isWhiteColor } from '../utils/color-utils';

describe('Color Utilities', () => {

  describe('isHexColor', () => {
    test('should return true for valid 3-digit and 6-digit hex colors', () => {
      expect(isHexColor('#fff')).toBe(true);
      expect(isHexColor('#ffffff')).toBe(true);
      expect(isHexColor('#ABCDEF')).toBe(true);
      expect(isHexColor('#123')).toBe(true);
    });


    test('should return false for invalid hex formats', () => {
      expect(isHexColor('fff')).toBe(false); // missing #
      expect(isHexColor('#gggggg')).toBe(false); // invalid characters
      expect(isHexColor('#1234')).toBe(false); // invalid length
      expect(isHexColor('')).toBe(false);
      expect(isHexColor(null)).toBe(false);
      expect(isHexColor(undefined)).toBe(false);
    });
  });


  describe('parseColorToRGB', () => {
    test('should correctly parse 6-digit hex colors', () => {
      expect(parseColorToRGB('#ffffff')).toEqual([255, 255, 255]);
      expect(parseColorToRGB('#000000')).toEqual([0, 0, 0]);
      expect(parseColorToRGB('#ff0000')).toEqual([255, 0, 0]);
    });


    test('should correctly parse 3-digit hex colors', () => {
      expect(parseColorToRGB('#f00')).toEqual([255, 0, 0]);
      expect(parseColorToRGB('#0f0')).toEqual([0, 255, 0]);
    });


    test('should correctly parse rgb format strings', () => {
      expect(parseColorToRGB('rgb(255, 0, 0)')).toEqual([255, 0, 0]);
      expect(parseColorToRGB('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
      expect(parseColorToRGB('rgb(255,255,255)')).toEqual([255, 255, 255]);
    });


    test('should return [undefined, undefined, undefined] for invalid formats', () => {
      expect(parseColorToRGB('invalid-color')).toEqual([undefined, undefined, undefined]);
      expect(parseColorToRGB('')).toEqual([undefined, undefined, undefined]);
    });
  });


  describe('isDarkColor', () => {
    test('should return true for dark colors based on luminance', () => {
      expect(isDarkColor('#000000')).toBe(true); // Black
      expect(isDarkColor('rgb(20, 20, 20)')).toBe(true); // Dark Grey
      expect(isDarkColor('#0000ff')).toBe(true); // Pure Blue (approx 29/255)
    });


    test('should return false for light colors', () => {
      expect(isDarkColor('#ffffff')).toBe(false); // White
      expect(isDarkColor('#ffff00')).toBe(false); // Yellow
      expect(isDarkColor('rgb(200, 200, 200)')).toBe(false);
    });


    test('should return false for invalid inputs', () => {
      expect(isDarkColor('')).toBe(false);
      expect(isDarkColor(null)).toBe(false);
      expect(isDarkColor('unknown')).toBe(false);
    });
  });


  describe('isWhiteColor', () => {
    test('should identify various forms of white color', () => {
      expect(isWhiteColor('white')).toBe(true);
      expect(isWhiteColor('WHITE')).toBe(true);
      expect(isWhiteColor('#fff')).toBe(true);
      expect(isWhiteColor('#ffffff')).toBe(true);
      expect(isWhiteColor('rgb(255,255,255)')).toBe(true);
      expect(isWhiteColor('rgba(255,255,255,1)')).toBe(true);
    });


    test('should handle whitespace and case sensitivity', () => {
      expect(isWhiteColor('  #FFFFFF  ')).toBe(true);
      expect(isWhiteColor('  white ')).toBe(true);
      expect(isWhiteColor('White')).toBe(true);
    });


    test('should return false for non-white colors', () => {
      expect(isWhiteColor('#000')).toBe(false);
      expect(isWhiteColor('red')).toBe(false);
      expect(isWhiteColor('rgb(254, 254, 254)')).toBe(false);
      expect(isWhiteColor(null)).toBe(false);
      expect(isWhiteColor(undefined)).toBe(false);
    });
  });
});
