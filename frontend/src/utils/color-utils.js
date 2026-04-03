export const isHexColor = (color = '') => {
  if (!color) return false;
  const reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
  return reg.test(color);
};

export const parseColorToRGB = (color) => {
  let r;
  let g;
  let b;
  if (isHexColor(color)) {
    color = color.substring(1);
    if (color.length === 3) {
      color = color.split('').map(c => c + c).join('');
    }
    r = parseInt(color.substring(0, 2), 16);
    g = parseInt(color.substring(2, 4), 16);
    b = parseInt(color.substring(4, 6), 16);
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  }
  return [r, g, b];
};

export const isDarkColor = (color) => {
  if (!color) return false;
  const [r, g, b] = parseColorToRGB(color);
  if (r === undefined || g === undefined || b === undefined) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

export const isWhiteColor = (color) => {
  if (!color) return false;
  const colorStr = color.toString().toLowerCase().trim().replace(' ', '');
  const whiteColors = ['white', '#fff', '#ffffff', 'rgb(255,255,255)', 'rgba(255,255,255,1)'];
  return whiteColors.includes(colorStr);
};
