import { STYLE_COLORS } from '@/components/chart/constants';

const COLORS = STYLE_COLORS[0].colors;
const TYPE_COLORS = {
  bug: COLORS[0],
  feature: COLORS[3],
  question: COLORS[2],
  task: COLORS[4],
};
const CUSTOM_COLORS = COLORS.slice(5);

export const TOTAL_COLOR = COLORS[0];

export function getSeriesColor(issueType) {
  if (!issueType) return COLORS[1];
  const name = issueType.toLowerCase();
  if (TYPE_COLORS[name]) return TYPE_COLORS[name];
  const hash = Array.from(name).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return CUSTOM_COLORS[hash % CUSTOM_COLORS.length];
}
