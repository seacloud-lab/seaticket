const BACKGROUND_COLOR_ALPHA = 0.08;
const BACKGROUND_COLOR_BASE = '#FFFFFF';

/**
 * Mixes a theme color into white to create a subtle automatic background color.
 * @param {string} themeColor A six-digit hex color, with or without a leading #.
 * @returns {string} The resulting six-digit hex color, including a leading #.
 */
export const getAutoBackgroundColor = (themeColor) => {
  const themeColorMatch = themeColor.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  const baseColorMatch = BACKGROUND_COLOR_BASE.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!themeColorMatch || !baseColorMatch) {
    return BACKGROUND_COLOR_BASE;
  }
  const channels = themeColorMatch.slice(1).map((channel, index) => {
    const foreground = parseInt(channel, 16);
    const background = parseInt(baseColorMatch[index + 1], 16);
    return Math.round(foreground * BACKGROUND_COLOR_ALPHA + background * (1 - BACKGROUND_COLOR_ALPHA));
  });
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
