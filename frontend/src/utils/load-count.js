const DEFAULT_COUNT = 20;

export const getLoadCount = (itemHeight, totalHeight = window.innerHeight) => {
  if (!itemHeight || itemHeight <= 0) return DEFAULT_COUNT;
  const rawCount = Math.ceil(totalHeight / itemHeight);
  return Math.max(Math.ceil(rawCount / 10) * 10, DEFAULT_COUNT);
};
