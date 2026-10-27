const TYPE_COLORS = {
  bug: '#5889ff',
  feature: '#ffd154',
  question: '#5d7092',
  task: '#9270ca',
};
const CUSTOM_COLORS = ['#e8684a', '#6dc8ec', '#9270ca', '#ff9d4d', '#269a99', '#d667a3'];

export const TOTAL_COLOR = '#5889ff';

export function getSeriesColor(issueType) {
  if (!issueType) return '#54d6a3';
  const name = issueType.toLowerCase();
  if (TYPE_COLORS[name]) return TYPE_COLORS[name];
  const hash = Array.from(name).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return CUSTOM_COLORS[hash % CUSTOM_COLORS.length];
}
