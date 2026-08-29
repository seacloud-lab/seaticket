/* global BigInt */

export const bytesToSize = (bytes) => {
  if (typeof(bytes) === 'undefined' || bytes === null) return ' ';
  if (bytes < 0) return '--';

  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const canUseBigInt = typeof bytes === 'bigint' ||
    (typeof bytes === 'string' && /^\d+$/.test(bytes)) ||
    (typeof bytes === 'number' && Number.isSafeInteger(bytes));
  if (canUseBigInt) {
    const value = BigInt(bytes);
    if (value === BigInt(0)) return `0 ${sizes[0]}`;
    const base = BigInt(1000);
    let scale = BigInt(1);
    let unit = 0;
    while (unit < sizes.length - 1 && value >= scale * base) {
      scale *= base;
      unit += 1;
    }
    if (unit === 0) return `${value} ${sizes[0]}`;
    const scaledTenths = (value * BigInt(10) + scale / BigInt(2)) / scale;
    return `${scaledTenths / BigInt(10)}.${scaledTenths % BigInt(10)} ${sizes[unit]}`;
  }

  if (bytes === 0) return bytes + ' ' + sizes[0];
  const unit = parseInt(Math.floor(Math.log(bytes) / Math.log(1000)), 10);
  if (unit === 0) return bytes + ' ' + sizes[unit];
  return (bytes / (1000 ** unit)).toFixed(1) + ' ' + sizes[unit];
};
