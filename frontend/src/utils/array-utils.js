export const areArraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  let count = {};
  arr1.forEach(item => count[item] = (count[item] || 0) + 1);

  return arr2.every(item => {
    if (!count[item]) return false;
    count[item]--;
    return true;
  });
};
